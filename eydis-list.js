/* globals angular */

angular.module('eydis.list', ['eydis.gapi']).
factory('eydisList', function($gapi, $q){
    'use strict';

    /*
      If using an already loaded client specify config as:
        {
          library: $gapi.client.drive,
          resource: 'files'
        }

      If you want the library to be loaded:
        {
          library: 'drive',
          version: 'v2',
          resource: 'files'
        }

      For loading a google cloud endpoints api, specify `api_root`:
        {
          library: 'ferris',
          version: 'v1',
          resource: 'guestbook',
          api_root: true
        }

      You can also specify alternative method to use for the standard `list`, `insert`, `update`, `delete`, and `get`:

        {
          library: 'drive',
          version: 'v2',
          resource: 'files',
          delete: 'trash'
        }
    */
    var create = function(config){
      config = angular.extend({
        list: 'list',
        insert: 'insert',
        update: 'update',
        delete: 'delete',
        get: 'get'
      }, config);

      var ready_q = $q.defer();

      /* Setup our object. We'll return this so all references & methods go here. */
      var obj = {
        items: [],
        ready: ready_q.promise,
        library: null,
      };

      /*
        Before we do anything we need to setup a guard against calling
        any of these method without the target library being available
        first.

        There are two pathways here: the first is where the user asks
        us to load the library, the second is where the user provides
        us with the library directory.
      */

      var library;
      var library_promise;

      /* Do we need to load the library? */
      if(angular.isString(config.library)){
        library_promise =  $gapi.load(config.library, config.version, config.api_root).then(function(){
            library = $gapi.client[config.library][config.resource];
            return library;
        });
      }
      /* Otherwise, we just need to make a wait_for_loaded that has an already resolved promise */
      else {
        library = config.library;
        var lq = $q.defer();
        lq.resolve(config.library);
        library_promise = lq.promise();
      }

      /*
        When the library is ready, resolve the ready promise.
        This allows usage via route.resolves
      */
      library_promise.then(function(library){
        obj.library = library;
        ready_q.resolve(obj);
      });

      /*
        We'll wrap every method in this to delay caling the method
        Until the library is ready.
      */
      var wait_for_loaded = function(f){
        return function(){
          var args = Array.prototype.slice.call(arguments);
          return library_promise.then(function(){
            return f.apply(this, args);
          });
        };
      };

      /*
        This method loads the list of items from the library.

        params are passed through to the library method.
      */
      obj.list = wait_for_loaded(function list(params, append){
        /* store these for next page */
        obj.list.list_params = params || {};
        var p = library[config.list](params);

        /* When successful, update our list */
        p.then(function(r){
          if(!append){
            obj.items = r.result.items;
          } else {
            obj.items = obj.items.concat(r.result.items);
          }
          obj.list.next_page_token = r.result.next_page_token || r.result.nextPageToken;
          obj.list.more = !!obj.list.next_page_token;
        });
        return p;
      });

      /* Indicates whether or not there are more pages */
      obj.list.more = false;

      /*
        Loads the next page for the given list.

        If append is true, then the results are appended to the existing list
        If append is false, then the results replace the existing list
      */
      obj.list.next_page = function list_next(append){
        obj.list.list_params.page_token = obj.list.list_params.pageToken = obj.list.next_page_token;
        return obj.list(obj.list.list_params, append);
      };

      /*
        Add a new object. This saves it using the library's insert() method and
        then optionally inserts the item into the list when successful.

        position, if set, determines where in the list to insert the new item.
         * 'start' or 0 will add the item to the beginning.
         * 'end' or -1 will add the item to the end.
         * Any integer will insert the item in that position in the lisy.
      */
      obj.insert = wait_for_loaded(function insert(data, position){
        var p = library[config.insert](data);

        /* When successful, add the item to our list */
        p.then(function(r){
          if(position !== undefined){
            if(position === 'start') position = 0;
            if(position === 'end' || position === -1){
              obj.items.push(r.result);
            } else {
              obj.items.splice(position, 0, r.result);
            }
          }
        });

        return p;
      });

      /*
        Calls the library's delete() method to remove the item and optimistically
        removes the item from the list unless retain is set to true.
      */
      obj.delete = wait_for_loaded(function _delete(item, retain){
        /* Go ahead and remove the item from the list before making any requests */
        if(!retain){
          var index = obj.items.indexOf(item);
          if(index !== -1){
            obj.items.splice(index, 1);
          }
        }

        /* If the item has a key make a request to remove it */
        if(item.datastore_key.urlsafe){
          return library[config.delete]({item_key: item.datastore_key.urlsafe});
        }
        /* Otherwise return an empty, successful promise */
        else {
          var d = $q.defer();
          d.resolve();
          return d.promise;
        }
      });

      /*
        Fetches the item using the library's get() method and will update the
        the item in the list if it is present.
      */
      obj.get = wait_for_loaded(function get(item, no_update){
        /* Only get if the item actually has a key */
        if(item.datastore_key.urlsafe){
          var p = library[config.get]({item_key: item.datastore_key.urlsafe});
          /* When succesful, update the item in our list */
          p.then(function(r){
            if(!no_update){
              var index = obj.items.indexOf(item);
              if(index !== -1){
                obj.items[index] = r.result;
              }
            }
          });
          return p;
        }
        /* If the item doesn't have a key then return an empty, failed promise */
        else {
          var d = $q.defer();
          d.reject();
          return d.promise;
        }
      });

      /*
        Updates an existing item using the library's update() method
        and will update the item in the list if it is present.
      */
      obj.update = wait_for_loaded(function update(item, no_update){
        /* Only update if the item actually has a key */
        if(item.datastore_key.urlsafe){
          var data = angular.copy(item);
          delete data.datastore_key;
          data.item_key = item.datastore_key.urlsafe;
          var p = library[config.update](data);

          /* When succesful, update the item in our list */
          p.then(function(r){
            if(!no_update){
              var index = obj.items.indexOf(item);
              if(index !== -1){
                obj.items[index] = r.result;
              }
            }
          });
          return p;
        }
        /* If the item doesn't have a key then return an empty, failed promise */
        else {
          var d = $q.defer();
          d.reject();
          return d.promise;
        }
      });

      return obj;
    };

    return create;
});
