Eydis List: List management for Endpoints/Google APIs
=====================================================

Eydis List eases the use of list management logic in AngularJS controllers when working with Google APIs or APIs created with Google Cloud Endpoints.

Installation
------------

Install by downloading or via bower:

    bower install --save eydis-list


Include the javascript file:

    <script src="bower_components/eydis-list/eydis-list.js"></script>

Requirements
------------

You must have [Eydis Gapi](https://github.com/jonparrott/Eydis-GAPI) installed and configured. 

Usage
-----

Depend on ``eydis.list`` and inject ``eydisList`` and use it to create a new list service.
    
```javascript
angular.module('app', ['eydis.list']).
.controller('exampleCtrl', function(eydisList){
    /* eydis list will automatically load the appropriate API */
    this.files = eydisList({
      library: 'drive',
      version: 'v2',
      resource: 'files',
      /*
        This is the parameter you pass to a request to get, update, or delete.
        In google APIs this is typically '[resource]Id', for example 'fileId'.
      */
      id_parameter: 'fileId'
    });

    /* Make the initial call to load the list */
    this.files.list();
});
```

You could also use route resolve.

```javascript
angular.module('app', ['eydis.list'])
.config(function($routeProvider){
  $routeProvider
    .when('/example', {
      templateUrl: 'example/example.html',
      controller: 'exampleCtrl',
      controllerAs: 'example',
      resolve: {
        files: function(eydisList){
          return eydisList({
            library: 'drive',
            version: 'v2',
            resource: 'files',
            id_parameter: 'fileId'
          }).ready;
        }
      }
    });
})
.controller('exampleCtrl', function(files){
  this.files = files;
  this.files.list();
});
```

Showing the list in the template is very easy.

```html
<div ng-controller="exampleCtrl as example">
<ul>
    <li ng-repeat="item in example.files.items">
        {{item.title}}
    </li>
</ul>
</div>
```

The service (``files`` in the above example) provides the following for loading and pagination:

 * ``service.items`` is an array of all of the currently loaded items.
 * ``service.list([params], [options])`` will fetch the items from the server.

    ```javascript
    this.files.list({maxResults: 10});
    this.files.list({maxResults: 10, query: 'red'});
    ```
 * ``service.list.more`` indicates if there is another page of results that can be loaded.
 * ``service.list.next([options])`` will load the next page, re-using the parameters passed to get the first page. If options.append is specified, it'll combine the new results with the existing list instead of replacing.
    
    ```html
    <button type="button"
        ng-show="example.files.list.more"
        ng-click="example.files.list.next()">
        Load More
    </button>
    ```

While these methods are useful, the service provides some additional functionality for manipulating items in the list:

 * ``service.delete(item, [retain])`` will call the delete() method on the API and will optimistically remove the item from the list.
 * ``service.get(item, [no_update])`` will call the get() method on the API and update the item in the list in-place.
 * ``service.update(item, [no_update])`` will call the update() method on the API to update the given item's data and will update the item in the list in-place when the server acknowledges the request. The re-update is usually idepotent but is useful if the server updates things such as modified time.


Advanced Configuration
----------------------

If using an already loaded client specify config as:

```javascript
{
  library: $gapi.client.drive,
  resource: 'files'
}
```

If you want the library to be loaded:

```javascript
{
  library: 'drive',
  version: 'v2',
  resource: 'files'
}
```

For loading a google cloud endpoints api, specify ``api_root``:

```javascript
{
  library: 'ferris',
  version: 'v1',
  resource: 'guestbook',
  api_root: true
}
```

You can also specify alternative method to use for the standard ``list``, ``insert``, ``update``, ``delete``, and ``get``:

```javascript
{
  library: 'drive',
  version: 'v2',
  resource: 'files',
  delete: 'trash'
}
```


License & Contributions
-----------------------

This is open-source under the Apache License, version 2. See license.txt for more info.

Contributions in the form of documentation, bug reports, patches, etc. are warmly welcomed.
