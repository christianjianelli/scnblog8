angular.module('myApp', ['ngRoute'], function($httpProvider) {

    // Use x-www-form-urlencoded Content-Type
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.headers.put['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    /**
     * Converts an object to x-www-form-urlencoded serialization.
     * @param {Object} obj
     * @return {String}
     */
    var param = function(obj) {

        var query = '',
            name,
            value,
            fullSubName,
            subName,
            subValue,
            innerObj,
            i;

        for (name in obj) {

            if (obj.hasOwnProperty(name)) {

                value = obj[name];

                if (value instanceof Array) {

                    for (i = 0; i < value.length; i = i + 1) {

                        subValue = value[i];
                        fullSubName = name + '[' + i + ']';
                        innerObj = {};
                        innerObj[fullSubName] = subValue;
                        query += param(innerObj) + '&';

                    }

                } else if (value instanceof Object) {

                    for (subName in value) {

                        if (value.hasOwnProperty(subName)) {

                            subValue = value[subName];
                            fullSubName = name + '[' + subName + ']';
                            innerObj = {};
                            innerObj[fullSubName] = subValue;
                            query += param(innerObj) + '&';

                        }

                    }
                } else if (value !== undefined && value !== null) {
                    query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
                }

            }

        }

        return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [

        function(data) {
            return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
        }
    ];

});

/** 
 * Defines myApp module configuration 
 */
angular.module('myApp').config(

    /* Defines myApp routes and views */
    function($routeProvider) {

        $routeProvider.when('/', {
            controller: 'MainController',
            templateUrl: 'main.html'
        });

        $routeProvider.when('/contact/:email/', {
            controller: 'ContactController',
            templateUrl: 'contact.html'
        });

        $routeProvider.otherwise({
            redirectTo: '/'
        });

    }

);

angular.module('myApp').service('TokenService', function($rootScope) {

    // Stores user's private key used to create the token in the getToken method.   
    this.pkey = '';

    var self = this;

    this.askForPkey = function() {
        self.pkey = window.prompt("Please inform your private key", "12345");
    };

    this.setPkey = function(sPkey) {
        self.pkey = sPkey;
    };

    this.getToken = function(params) {

        var timestamp = Date.now();

        var auth_token_con = '';
        var auth_token_s2s = '';

        angular.forEach(params, function(value, key) {

            auth_token_con = auth_token_con + value + '|';
            auth_token_s2s = auth_token_s2s + key + '|';

        });

        if (self.pkey === '') {
            self.askForPkey();
        }

        auth_token_con = auth_token_con + timestamp + '|' + self.pkey;
        auth_token_s2s = auth_token_s2s + 'timestamp';

        var token = CryptoJS.SHA1(auth_token_con);

        var auth = {
            token: token.toString(),
            token_s2s: auth_token_s2s,
            token_uid: 'IU_TEST',
            timestamp: timestamp
        };    

        return auth;

    };

});

/**
 *  Creates the contacts service, responsible for storing and handling contact's data 
 */
angular.module('myApp').service('ContactsService', function($http, $location, $rootScope, TokenService) {

    this.contacts = [];

    this.contact = {
        email: '',
        firstname: '',
        lastname: '',
        phone: ''
    };

    this.rootScope = $rootScope;

    this.isFinished = true;

    this.serverUrl = 'http://yourserver:port/sap/zrestapi/myApp/contacts';

    var self = this;

    this.loadingFinished = function() {
        
        window.setTimeout(function() {
            self.rootScope.$apply(function() {
                self.rootScope.data.loading = false;
            });
        }, 500);

    };

    /**  
     *  Adds a new contact
     */
    this.addContact = function(contact) {     

        var auth = TokenService.getToken(contact);

        var params = {
            email: contact.email,
            firstname: contact.firstname,
            lastname: contact.lastname,
            phone: contact.phone,
            timestamp: auth.timestamp
        };

        self.rootScope.data.loading = true;

        $http.post(self.serverUrl, 
            params,
            { 
                timeout: 30000,
                headers: {
                    'Auth-Token': auth.token,
                    'Auth-Token-S2S': auth.token_s2s,
                    'Auth-Token-UID': auth.token_uid
                }
            }
        ).success(function(oData) {

            self.loadingFinished();

            if (oData.success === 'true' || oData.success === true) {

                self.contacts.push(contact);
            
                self.contact.email = '';
                self.contact.firstname = '';
                self.contact.lastname = '';
                self.contact.phone = '';

                if (angular.isString(oData.msg)) {
                    self.rootScope.data.message = oData.msg;
                }

            }else{

                if (angular.isString(oData.msg)) {
                    self.rootScope.data.message = oData.msg;
                }

            }

        }).error(function(data, status) {

            self.loadingFinished();

            if (status === 0) {
                self.rootScope.data.message = 'Communication error: timeout.';
            }else if(data !== null && data !== undefined ) {
                    if (data.msg !== undefined) {              
                        if (angular.isString(data.msg)) {
                            self.rootScope.data.message = data.msg;
                        }else{
                            self.rootScope.data.message = 'Communication error: server returned code ' + status;
                        }
                    }else{
                        self.rootScope.data.message = 'Communication error: server returned code ' + status;
                    }
            }else{
                self.rootScope.data.message = 'Communication error: server returned code ' + status;
            } 
        });

    };

    /**  
     *  Retrieves all contacts
     */ 
    this.getContacts = function() {

        var auth = TokenService.getToken({});

        self.rootScope.data.loading = true;

        $http.get(self.serverUrl, { 
            timeout: 30000,
            params: {
                timestamp: auth.timestamp
            },
            headers: {
                'Auth-Token': auth.token,
                'Auth-Token-S2S': auth.token_s2s,
                'Auth-Token-UID': auth.token_uid
            }
        }).success(function(oData) {

            self.loadingFinished();

            if (angular.isArray(oData.contacts)) {
                
                self.contacts.splice(0, self.contacts.length);
                
                oData.contacts.forEach(function (contact) {
                    self.contacts.push(contact);
                });
            }

        }).error(function(data, status) {

            self.loadingFinished();

            if (status === 0) {
                self.rootScope.data.message = 'Communication error: timeout.';
            }else if(data !== null && data !== undefined ) {
                    if (data.msg !== undefined) {              
                        if (angular.isString(data.msg)) {
                            self.rootScope.data.message = data.msg;
                        }else{
                            self.rootScope.data.message = 'Communication error: server returned code ' + status;
                        }
                    }else{
                        self.rootScope.data.message = 'Communication error: server returned code ' + status;
                    }
            }else{
                self.rootScope.data.message = 'Communication error: server returned code ' + status;
            } 
        });

    };

    /** 
     *  Retrieves contact's data 
     *  @param {Object} obj
     */    
    this.getContact = function(id) {

        var email = id;

        var auth = TokenService.getToken({email:id});

        self.rootScope.data.loading = true;

        $http.get(self.serverUrl, { 
            timeout: 30000,
            params: {
                email: email,
                timestamp: auth.timestamp
            },
            headers: {
                'Auth-Token': auth.token,
                'Auth-Token-S2S': auth.token_s2s,
                'Auth-Token-UID': auth.token_uid
            }
        }).success(function(oData) {

            self.loadingFinished();

            if (angular.isArray(oData.contacts)) {

                oData.contacts.forEach(function (contact) {
                    
                    self.contact.email = contact.email;
                    self.contact.firstname = contact.firstname;
                    self.contact.lastname = contact.lastname;
                    self.contact.phone = contact.phone;

                });

            }

        }).error(function(data, status) {

            self.loadingFinished();

            if (status === 0) {
                self.rootScope.data.message = 'Communication error: timeout.';
            }else if(data !== null && data !== undefined ) {
                    if (data.msg !== undefined) {              
                        if (angular.isString(data.msg)) {
                            self.rootScope.data.message = data.msg;
                        }else{
                            self.rootScope.data.message = 'Communication error: server returned code ' + status;
                        }
                    }else{
                        self.rootScope.data.message = 'Communication error: server returned code ' + status;
                    }
            }else{
                self.rootScope.data.message = 'Communication error: server returned code ' + status;
            }       
        });

    };

    /**  
     *  Updates selected contact
     */ 
    this.updateContact = function() {

        var auth = TokenService.getToken(self.contact);

        var params = {
            email: self.contact.email,
            firstname: self.contact.firstname,
            lastname: self.contact.lastname,
            phone: self.contact.phone,
            timestamp: auth.timestamp
        };

        self.rootScope.data.loading = true;

        $http.put(self.serverUrl,  
            params,
            { 
                timeout: 30000,
                headers: {
                    'Auth-Token': auth.token,
                    'Auth-Token-S2S': auth.token_s2s,
                    'Auth-Token-UID': auth.token_uid
                }
            }
        ).success(function(oData) {

            self.loadingFinished();

            if (oData.success === 'true' || oData.success === true) {

                if (angular.isString(oData.msg)) {
                    self.rootScope.data.message = oData.msg;
                }

            }else{

                if (angular.isString(oData.msg)) {
                    self.rootScope.data.message = oData.msg;
                }

            }

        }).error(function(data, status) {

            self.loadingFinished();

            if (status === 0) {
                self.rootScope.data.message = 'Communication error: timeout.';
            }else if(data !== null && data !== undefined ) {
                    if (data.msg !== undefined) {              
                        if (angular.isString(data.msg)) {
                            self.rootScope.data.message = data.msg;
                        }else{
                            self.rootScope.data.message = 'Communication error: server returned code ' + status;
                        }
                    }else{
                        self.rootScope.data.message = 'Communication error: server returned code ' + status;
                    }
            }else{
                self.rootScope.data.message = 'Communication error: server returned code ' + status;
            }  
        });

    };

    /**  
     *  Deletes selected contact
     */ 
    this.deleteContact = function() {

        var auth = TokenService.getToken({email: self.contact.email});

        self.rootScope.data.isFinished = false;

        self.rootScope.data.loading = true;

        $http.delete(self.serverUrl, { 
            timeout: 30000,
            params: {
                email: self.contact.email,
                timestamp: auth.timestamp
            },
            headers: {
                'Auth-Token': auth.token,
                'Auth-Token-S2S': auth.token_s2s,
                'Auth-Token-UID': auth.token_uid
            }
        }).success(function(oData) {

            self.loadingFinished();

            if (oData.success === 'true' || oData.success === true) {

                if (angular.isString(oData.msg)) {

                    self.rootScope.data.message = oData.msg;                    

                    self.contact.email = '';
                    self.contact.firstname = '';
                    self.contact.lastname = '';
                    self.contact.phone = '';

                    self.rootScope.data.isFinished = true;

                }

            }else{

                if (angular.isString(oData.msg)) {
                    self.rootScope.data.message = oData.msg;
                }

            }

        }).error(function(data, status) {

            self.loadingFinished();

            if (status === 0) {
                self.rootScope.data.message = 'Communication error: timeout.';
            }else if(data !== null && data !== undefined ) {
                    if (data.msg !== undefined) {              
                        if (angular.isString(data.msg)) {
                            self.rootScope.data.message = data.msg;
                        }else{
                            self.rootScope.data.message = 'Communication error: server returned code ' + status;
                        }
                    }else{
                        self.rootScope.data.message = 'Communication error: server returned code ' + status;
                    }
            }else{
                self.rootScope.data.message = 'Communication error: server returned code ' + status;
            }  
        });

    };

    /**
     * Reset selected contact in order to clear the form
     */
    this.resetSelectedContact = function(id) {
        self.contact.email = '';
        self.contact.firstname = '';
        self.contact.lastname = '';
        self.contact.phone = '';
    };

});

/**  
 *  Defines the main controller (for the view main.html)
 */ 
angular.module('myApp').controller('MainController',
    function($scope, $rootScope, ContactsService) {

        var rootScope = $rootScope;

        $scope.data = {};

        if ($rootScope.data === undefined) {
            $rootScope.data = {};
            $rootScope.data.message = null;
            $rootScope.data.pkey = null;
        }

        $rootScope.data.loading = false;

        ContactsService.resetSelectedContact();

        $scope.data.contact = ContactsService.contact;

        $scope.data.contacts = ContactsService.contacts;

        $scope.data.showPaneAddContact = false;

        ContactsService.getContacts();

        /**  
         *  Checks whether the contacts array is empty or not 
         */ 
        $scope.isEmpty = function(){
            if($scope.data.contacts.length > 0){
                return false;
            }else{
                return true;
            }
        };

        /**  
         *  Adds a new contact
         */ 
        $scope.addContact = function(form){

            if(form.$valid === true) {
        
                var contact = {
                    email: $scope.data.contact.email,
                    firstname: $scope.data.contact.firstname,
                    lastname: $scope.data.contact.lastname,
                    phone: $scope.data.contact.phone
                };

                ContactsService.addContact(contact);

                form.$setUntouched();

            }else{
                $rootScope.data.message = "All fields are required!";
            }

        };

        $scope.resetForm = function(form){
            ContactsService.resetSelectedContact();
            form.$setUntouched();    
        };

        /**  
         *  Clears displayed messages after 3 seconds
         */
        $scope.resetMessage = function() {

            window.setTimeout(function() {
                rootScope.$apply(function() {
                    rootScope.data.message = null;
                });
            }, 3000);
        
        };

        $scope.setPkey = function(){
            $rootScope.data.pkey = window.prompt("Please provide your private key", "");
        };

        /**  
         *  Watches changes of the variable "$rootScope.data.message" in order to clear
         *  displayed messages after 3 seconds
         */
        $rootScope.$watch(function(scope) { return scope.data.message },
            function(newValue, oldValue) {
                if (newValue !== oldValue && newValue !== "") {
                    $scope.resetMessage();
                };
            }
        );

    }
);

/**  
 *  Defines the contact controller (for the view contact.html)
 */ 
angular.module('myApp').controller('ContactController',
    function($scope, $routeParams, $location, $rootScope, ContactsService) {

        var rootScope = $rootScope;

        $rootScope.data = {};
        $rootScope.data.message = null;
        $rootScope.data.isFinished = true;

        $scope.data = {};
        $scope.data.isFinished = $rootScope.data.isFinished;
        $scope.data.contact = ContactsService.contact;

        ContactsService.getContact($routeParams.email);

        /**  
         *  Executes the updateContact method of ContactsService to update the selected contact.
         *  No information needs to be passed to identify the selected contact because the service knows who it is.
         */ 
        $scope.updateContact = function(form){

            if(form.$valid === true) {
                ContactsService.updateContact();
            }else{
                $rootScope.data.message = "All fields are required!";
            }

        };

        /**  
         *  Executes the deleteContact method of ContactsService to delete the selected contact.
         *  No information needs to be passed to identify the selected contact because the service knows who it is.
         */
        $scope.deleteContact = function(){

            ContactsService.deleteContact();

        };  

        /**  
         *  Navigates back to the main view
         */
        $scope.back = function(){

            ContactsService.resetSelectedContact();

            $location.url("/");

        };

        /**  
         *  Clears displayed messages after 3 seconds
         */
        $scope.resetMessage = function() {

            window.setTimeout(function() {
                rootScope.$apply(function() {
                    rootScope.data.message = null;
                });
            }, 3000);
        
        };

        /**  
         *  Watches changes of the variable "$rootScope.data.isFinished" in order to trigger
         *  the navigation back to the main view when a contact is deleted
         */
        $rootScope.$watch(function(scope) { return scope.data.isFinished },
            function(newValue, oldValue) {
                if (newValue === true && oldValue === false) {
                    $scope.back();
                };
            }
        );

        /**  
         *  Watches changes of the variable "$rootScope.data.message" in order to clear
         *  displayed messages after 3 seconds
         */
        $rootScope.$watch(function(scope) { return scope.data.message },
            function(newValue, oldValue) {
                if (newValue !== oldValue && newValue !== "") {
                    $scope.resetMessage();
                };
            }
        );

    }
);