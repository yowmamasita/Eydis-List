/* globals angular */

angular.module('eydis.list', ['eydis.gapi']).
factory('eydisList', function($gapi, $q){
    'use strict';

    /*
      If using an already loaded client specify config as:
        {
          library: $gapi.client.drive,
          resource: 'files',
          id_parameter: 'fileId'
        }

      If you want the library to be loaded:
        {
          library: 'drive',
          version: 'v2',
          resource: 'files',
          id_parameter: 'fileId'
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
        get: 'get',
        id_parameter: 'itemId',
        id_field: 'id'
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
        library_promise = $gapi.load(config.library, config.version, config.api_root).then(function(){
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
      obj.list = wait_for_loaded(function list(params, options){
        options = angular.extend({
          method: config.list,
          append: false
        }, options || {});

        /* store these for next page */
        obj.list.list_params = params || {};
        obj.list.list_options = options;

        /* Execute the method */
        var p = library[options.method](params);

        /* When successful, update our list */
        p.then(function(r){
          if(!options.append){
            obj.items = r.result.items || [];
          } else {
            obj.items = obj.items.concat(r.result.items || []);
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
      obj.list.next = function list_next(options){
        options = angular.extend(obj.list.list_options, options);
        obj.list.list_params.page_token = obj.list.list_params.pageToken = obj.list.next_page_token;
        return obj.list(obj.list.list_params, options);
      };

      /*
        Add a new object. This saves it using the library's insert() method and
        then optionally inserts the item into the list when successful.

        options.position, if set, determines where in the list to insert the new item.
         * 'start' or 0 will add the item to the beginning.
         * 'end' or -1 will add the item to the end.
         * Any integer will insert the item in that position in the lisy.
      */
      obj.insert = wait_for_loaded(function insert(data, options){
        options = angular.extend({
          method: config.insert,
          position: false
        }, options || {});

        var p = library[options.method](data);

        /* When successful, add the item to our list */
        p.then(function(r){
          if(options.position !== undefined && options.position !== false){
            if(options.position === 'start') options.position = 0;
            if(options.position === 'end' || options.position === -1){
              obj.items.push(r.result);
            } else {
              obj.items.splice(options.position, 0, r.result);
            }
          }
        });

        return p;
      });

      /*
        Calls the library's delete() method to remove the item and optimistically
        removes the item from the list unless options.retain is set to true.
      */
      obj.delete = wait_for_loaded(function _delete(item, options){
        options = angular.extend({
          method: config.delete,
          retain: false
        }, options || {});

        /* Go ahead and remove the item from the list before making any requests */
        if(!options.retain){
          var index = obj.items.indexOf(item);
          if(index !== -1){
            obj.items.splice(index, 1);
          }
        }

        /* If the item has a key make a request to remove it */
        var key = get_item_key(item);
        if(key){
          var data = {};
          data[config.id_parameter] = key;
          return library[options.method](data);
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
      obj.get = wait_for_loaded(function get(item, options){
        options = angular.extend({
          method: config.get,
          update: true
        }, options || {});

        /* Only get if the item actually has a key */
        var key = get_item_key(item);
        if(key){
          var data = {};
          data[config.id_parameter] = key;
          var p = library[options.method](data);
          /* When succesful, update the item in our list */
          p.then(function(r){
            if(options.update){
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
      obj.update = wait_for_loaded(function update(item, options){
        options = angular.extend({
          method: config.update,
          update: true
        }, options || {});

        /* Only update if the item actually has a key */
        var key = get_item_key(item);
        if(key){
          var data = strip_item_key(angular.copy(item));
          data[config.id_parameter] = key;
          var p = library[options.method](data);

          /* When succesful, update the item in our list */
          p.then(function(r){
            if(options.update){
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

      /* Helper function for seeing if an item has a key or not */
      var get_item_key = function(item){
        if(item[config.id_field]) return item[config.id_field];
        return null;
      };

      /* Helper function to remove the key from an object before submitting it */
      var strip_item_key = function(item){
        if(item[config.id_field]){
          delete item[config.id_field];
        }
        return item;
      };

      return obj;
    };

    return create;
});
