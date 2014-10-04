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
    this.files = eydisList('drive', 'v2', 'files');

    /* Make the initial call to load the list */
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
 * ``service.list([params])`` will fetch the items from the server.

    ```javascript
    this.files.list({maxResults: 10});
    this.files.list({maxResults: 10, query: 'red'});
    ```
 * ``service.list.more`` indicates if there is another page of results that can be loaded.
 * ``service.list.next_page([append])`` will load the next page, re-using the parameters passed to get the first page. If append is specified, it'll combine the new results with the existing list instead of replacing.
    
    ```html
    <button type="button"
        ng-show="example.files.list.more"
        ng-click="example.files.list.next_page()">
        Load More
    </button>
    ```

While these methods are useful, the service provides some additional functionality for manipulating items in the list:

 * ``service.delete(item, [retain])`` will call the delete() method on the API and will optimistically remove the item from the list.
 * ``service.get(item, [no_update])`` will call the get() method on the API and update the item in the list in-place.
 * ``service.update(item, [no_update])`` will call the update() method on the API to update the given item's data and will update the item in the list in-place when the server acknowledges the request. The re-update is usually idepotent but is useful if the server updates things such as modified time.


License & Contributions
-----------------------

This is open-source under the Apache License, version 2. See license.txt for more info.

Contributions in the form of documentation, bug reports, patches, etc. are warmly welcomed.
