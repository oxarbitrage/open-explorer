(function () {
    'use strict';

    angular.module('app.markets')
        .controller('marketsCtrl', ['$scope', '$filter', '$routeParams', '$location', '$http', '$websocket', 'appConfig', marketsCtrl]);

    function marketsCtrl($scope, $filter, $routeParams, $location, $http, $websocket, appConfig) {

        var path = $location.path();
        var name = $routeParams.name;

        if(name) {
            name = name.toUpperCase();
            if(path.includes("markets")) {
                var name2 = $routeParams.name2;
                name2 = name2.toUpperCase();

                [name,name2] = [name2,name];
                //console.log(name2);

                var ticker = {};
                $http.get(appConfig.urls.python_backend + "/get_ticker?base=" + name + "&quote=" + name2)
                    .then(function(response3) {
                        //var base_precision = 5;
                        $http.get(appConfig.urls.python_backend + "/get_asset?asset_id=" + name)
                            .then(function(response_b) {
                                var base_id = response_b.data[0].id;
                                var base_precision = response_b.data[0].precision;


                                $http.get(appConfig.urls.python_backend + "/get_asset?asset_id=" + name2)
                                    .then(function(response_q) {
                                        var quote_id = response_q.data[0].id;
                                        var quote_precision = response_q.data[0].precision;

                                        var parsed = {
                                            price: response3.data.latest,
                                            ask: response3.data.lowest_ask,
                                            bid: response3.data.highest_bid,
                                            base_volume: parseInt(response3.data.base_volume),
                                            quote_volume: parseInt(response3.data.quote_volume),
                                            perc_change: response3.data.percent_change,
                                            base: name,
                                            quote: name2,
                                            base_precision: base_precision
                                        };
                                        $scope.ticker = parsed;

                                        // subscription
                                        var dataStream = $websocket(appConfig.urls.websocket);
                                        var base = base_id;
                                        var quote = quote_id;
                                        dataStream.send('{"method": "call", "params": [0, "subscribe_to_market", [5, "' + base + '", "'+quote+'"]], "id": 7}');

                                        $scope.$on("$locationChangeStart", function(event) {
                                            // when leaving page unsubscribe from market
                                            dataStream.send('{"method": "call", "params": [0, "unsubscribe_from_market", ["' + base + '", "'+quote+'"]], "id": 8}');
                                        });

                                        dataStream.onMessage(function (message) {
                                            var parsed;
                                            try {
                                                // lets update the ticker
                                                var ticker = {};
                                                $http.get(appConfig.urls.python_backend + "/get_ticker?base=" + name + "&quote=" + name2)
                                                    .then(function(response3) {
                                                        //var base_precision = 5;
                                                        $http.get(appConfig.urls.python_backend + "/get_asset?asset_id=" + name)
                                                            .then(function(response_p) {
                                                                //base_precision = response_p.data[0].precision;

                                                                var parsed = {
                                                                    price: response3.data.latest,
                                                                    ask: response3.data.lowest_ask,
                                                                    bid: response3.data.highest_bid,
                                                                    base_volume: parseInt(response3.data.base_volume),
                                                                    quote_volume: parseInt(response3.data.quote_volume),
                                                                    perc_change: response3.data.percent_change,
                                                                    base: name,
                                                                    quote: name2,
                                                                    base_precision: base_precision
                                                                };
                                                                $scope.ticker = parsed;



                                                                // order book
                                                                var asks = [];
                                                                var bids = [];
                                                                $http.get(appConfig.urls.python_backend + "/get_order_book?base=" + name + "&quote=" + name2 + "&limit=10")
                                                                    .then(function(response) {
                                                                        //console.log(response);
                                                                        var total = 0;
                                                                        angular.forEach(response.data.asks, function(value, key) {
                                                                            total = total + parseFloat(value.quote);
                                                                            var parsed = {base: value.base, price: value.price, quote: value.quote, base_precision: base_precision, quote_precision: quote_precision, total: total};
                                                                            asks.push(parsed);
                                                                        });
                                                                        $scope.asks = asks;

                                                                        var total = 0;
                                                                        angular.forEach(response.data.bids, function(value, key) {
                                                                            total = total + parseFloat(value.quote);
                                                                            var parsed = {base: value.base, price: value.price, quote: value.quote, base_precision: base_precision, quote_precision: quote_precision, total: total};
                                                                            bids.push(parsed);
                                                                        });
                                                                        $scope.bids = bids;
                                                                    });
                                                                // end order book


                                                                // grouped order book
                                                                var grouped = [];
                                                                $http.get(appConfig.urls.python_backend + "/get_grouped_limit_orders?base=" + name + "&quote=" + name2 + "&group=100&limit=10")
                                                                    .then(function(response) {
                                                                        angular.forEach(response.data, function(value, key) {
                                                                            var total_for_sale = value.total_for_sale;
                                                                            var max_base_amount = value.max_price.base.amount;
                                                                            var max_quote_amount = value.max_price.quote.amount;
                                                                            var min_base_amount = value.min_price.base.amount;
                                                                            var min_quote_amount = value.min_price.quote.amount;

                                                                            var base_id = value.max_price.base.asset_id;
                                                                            var quote_id = value.max_price.quote.asset_id;

                                                                            var base_array = base_id.split(".");
                                                                            var quote_array = quote_id.split(".");
                                                                            var divide = 0;

                                                                            if(base_array[2] > quote_array[2])
                                                                            {
                                                                                divide = 1;
                                                                                base_precision, quote_precision = quote_precision, base_precision;
                                                                            }
                                                                            var qp = Math.pow(10, quote_precision);
                                                                            var bp = Math.pow(10, base_precision);

                                                                            if(divide) {
                                                                                var max_price = 1 / (max_base_amount / base_precision) / (max_quote_amount / quote_precision);
                                                                                var min_price = 1 / (min_base_amount / base_precision) / (min_quote_amount / quote_precision);
                                                                            }
                                                                            else {
                                                                                var max_price = (max_base_amount / base_precision) / (max_quote_amount / quote_precision);
                                                                                var min_price = (min_base_amount / base_precision) / (min_quote_amount / quote_precision);
                                                                            }
                                                                            var parsed = {max_price: max_price, min_price: min_price, total_for_sale: total_for_sale, base_precision: base_precision, quote_precision: quote_precision};
                                                                            grouped.push(parsed);
                                                                        });
                                                                        $scope.grouped = grouped;
                                                                    });
                                                                // end grouped order book



                                                            });
                                                    });
                                                parsed = JSON.parse(message.data);
                                                console.log(parsed);
                                                //parsed = JSON.parse(message.data).params[1][0][0];
                                            }
                                            catch (err) {
                                            }
                                            //console.log(parsed);
                                        });



                                        /// end subscription
                                    });




                            });
                    });
                //console.log(ticker);
                //$scope.ticker = ticker;

                //TradingView.onready(function()
                //{
                var widget = window.tvWidget = new TradingView.widget({
                    fullscreen: true,
                    symbol: name + '_' + name2,
                    interval: '60',
                    container_id: "tv_chart_container",
                    //	BEWARE: no trailing slash is expected in feed URL
                    datafeed: new Datafeeds.UDFCompatibleDatafeed(appConfig.urls.udf_wrapper),
                    library_path: "charting_library/",
                    locale: getParameterByName('lang') || "en",
                    //	Regression Trend-related functionality is not implemented yet, so it's hidden for a while
                    drawings_access: { type: 'black', tools: [ { name: "Regression Trend" } ] },
                    disabled_features: ["use_localstorage_for_settings"],
                    enabled_features: ["study_templates"],
                    charts_storage_url: 'http://saveload.tradingview.com',
                    charts_storage_api_version: "1.1",
                    client_id: 'tradingview.com',
                    user_id: 'public_user_id'
                });
                //});
                /*
                 $scope.pricechart = {};
                 $http.get(appConfig.urls.python_backend + "/market_chart_dates")
                 .then(function(response) {
                 //console.log(response.data);
                 $http.get(appConfig.urls.python_backend + "/market_chart_data?base=" + name + "&quote=" + name2)
                 .then(function(response2) {

                 $scope.pricechart.options = {
                 animation: true,
                 title : {
                 text: name + '/' + name2
                 },
                 tooltip : {
                 trigger: 'axis'
                 },
                 legend: {
                 data:['Blu']
                 },
                 toolbox: {
                 show : true,
                 feature : {
                 saveAsImage : {show: true, title: "save as image"}
                 }
                 },

                 xAxis : [
                 {
                 type : 'category',
                 boundaryGap : true,
                 axisTick: {onGap:false},
                 splitLine: {show:false},
                 data : response.data,
                 }
                 ],
                 yAxis : [
                 {
                 type : 'value',
                 scale:true,
                 boundaryGap: [0.01, 0.01],
                 min: 0
                 }
                 ],
                 calculable : true,
                 series : [
                 {
                 name:'Price',
                 type:'candlestick',
                 itemStyle: {
                 normal: {
                 color: 'green',
                 color0: 'red',
                 borderColor: 'green',
                 borderColor0: 'red'

                 }
                 },
                 data: response2.data
                 }
                 ]
                 };
                 });
                 });
                 */
                // table 1
                // column to sort
                $scope.column = 'price';
                // sort ordering (Ascending or Descending). Set true for desending
                $scope.reverse = false;
                // called on header click
                $scope.sortColumn = function(col){
                    $scope.column = col;
                    if($scope.reverse){
                        $scope.reverse = false;
                        $scope.reverseclass = 'arrow-up';
                    }else{
                        $scope.reverse = true;
                        $scope.reverseclass = 'arrow-down';
                    }
                };
                // remove and change class
                $scope.sortClass = function(col) {
                    if ($scope.column == col) {
                        if ($scope.reverse) {
                            return 'arrow-down';
                        } else {
                            return 'arrow-up';
                        }
                    } else {
                        return '';
                    }
                }
                // table 2
                // column to sort
                $scope.column2 = 'price';
                // sort ordering (Ascending or Descending). Set true for desending
                $scope.reverse2 = true;
                // called on header click
                $scope.sortColumn2 = function(col2){
                    $scope.column2 = col2;
                    if($scope.reverse2){
                        $scope.reverse2 = false;
                        $scope.reverseclass2 = 'arrow-up';
                    }else{
                        $scope.reverse2 = true;
                        $scope.reverseclass2 = 'arrow-down';
                    }
                };
                // remove and change class
                $scope.sortClass2 = function(col2) {
                    if ($scope.column2 == col2) {
                        if ($scope.reverse2) {
                            return 'arrow-down';
                        } else {
                            return 'arrow-up';
                        }
                    } else {
                        return '';
                    }
                }


            }
        }
        else {
            if(path == "/markets") {
                $http.get(appConfig.urls.python_backend + "/get_most_active_markets")
                    .then(function(response) {
                        //console.log(response.data);
                        var markets = [];
                        angular.forEach(response.data, function(value, key) {
                            var parsed = {pair: value[1], price: value[3], volume: value[4]};
                            markets.push(parsed);
                        });
                        $scope.markets = markets;
                    });
            }
            // column to sort
            $scope.column = 'volume';
            // sort ordering (Ascending or Descending). Set true for desending
            $scope.reverse = true;
            // called on header click
            $scope.sortColumn = function(col){
                $scope.column = col;
                if($scope.reverse){
                    $scope.reverse = false;
                    $scope.reverseclass = 'arrow-up';
                }else{
                    $scope.reverse = true;
                    $scope.reverseclass = 'arrow-down';
                }
            };
            // remove and change class
            $scope.sortClass = function(col) {
                if ($scope.column == col) {
                    if ($scope.reverse) {
                        return 'arrow-down';
                    } else {
                        return 'arrow-up';
                    }
                } else {
                    return '';
                }
            }
        }
    }
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }
})();
