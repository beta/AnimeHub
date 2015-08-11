var printError = function (error) {
    console.error(error);
}

// Gets an access token from AniList.
var getAniListToken = function (options) {
    options = (typeof options !== 'object') ? {} : options;
    options.success = options.success || function (data, textStatus, jqXHR) { };
    options.error = options.error || function (jqXHR, textStatus, errorThrown) { };

    $.ajax({
        url: "https://anilist.co/api/auth/access_token",
        data: {
            grant_type: 'client_credentials',
            client_id: _config.anilist_client_id,
            client_secret: _config.anilist_client_secret
        },
        method: 'POST',
        success: function (data, textStatus, jqXHR) {
            options.success(data.access_token);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            options.error(errorThrown);
        }
    });
}

// Gets info of an anime from AniList.
var fetchAnimeInfo = function (options) {
    options = (typeof options !== 'object') ? {} : options;
    options.id = options.id || 1;
    options.aid = options.aid || 0;
    options.index = options.index || 0;
    options.body = options.body || "";
    options.success = options.success || function (data, textStatus, jqXHR) { };
    options.error = options.error || function (jqXHR, textStatus, errorThrown) { };
    
    $.ajax({
        url: "https://anilist.co/api/anime/" + options.aid,
        data: {
            access_token: window.animehub.aniListToken
        },
        success: function (data, textStatus, jqXHR) {
            data.id = options.id;
            data.index = options.index;
            data.body = options.body;
            options.success(data);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            options.error(errorThrown);
        }
    });
}

// Gets the list of reviews (issues) from the GitHub repo.
var fetchReviewList = function (options) {
    options = (typeof options !== 'object') ? {} : options;
    options.page = options.page || 1
    options.beforeSend = options.beforeSend || function () { };
    options.success = options.success || function (data, textStatus, jqXHR) { };
    options.error = options.error || function (jqXHR, textStatus, errorThrown) { };

    $.ajax({
        url: "https://api.github.com/repos/" + _config.username + "/" + _config.repo + "/issues",
        data: {
            page: options.page
        },
        beforeSend: options.beforeSend,
        success: function (data, textStatus, jqXHR) {
            options.success(data, jqXHR);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            options.error(errorThrown);
        }
    });
}

// Gets, stores and pre-renders the reviews.
var fetchAllReviewList = function (page) {
    fetchReviewList({
        page: page,
        beforeSend: function () {
        },
        success: function (data, jqXHR) {
            var link = jqXHR.getResponseHeader('Link') || "";
            var next = (link.indexOf('rel="next"') > 0);
            var prev = (link.indexOf('rel="prev"') > 0);
            
            var reviewList = [];
            var ractiveIndex = new Ractive({
                el: 'main',
                template: '#listTemplate',
                data: {
                    siteTitle: _config.title,
                    reviewList: reviewList,
                    next: next,
                    prev: prev,
                    page: page
                }
            });
            
            for (var i = 0; i < data.length; i++) {
                var aid = data[i].title;
                fetchAnimeInfo({
                    id: data[i].number,
                    aid: aid,
                    index: i,
                    body: data[i].body,
                    success: function (animeData) {
                        var review = {
                            id: animeData.id,
                            aid: animeData.id,
                            title: animeData.title_japanese,
                            body: animeData.body,
                            cover: animeData.image_url_lge,
                            banner: (animeData.image_url_banner) ? animeData.image_url_banner : animeData.image_url_lge
                        };
                        
                        var ractiveAnime = new Ractive({
                            template: '#detailTemplate',
                            data: {
                                siteTitle: _config.title,
                                review: review
                            }
                        });
                        window.animehub.reviews[review.id] = {};
                        window.animehub.reviews[review.id].data = review;
                        window.animehub.reviews[review.id].html = ractiveAnime.toHTML();
                        
                        reviewList[animeData.index] = review;
                        ractiveIndex.set('reviewList', reviewList);
                        window.animehub.reviewList[page] = ractiveIndex.toHTML();
                    },
                    error: function (error) {
                        printError(error);
                    }
                });
            }
        },
        error: function (error) {
            printError(error);
        }
    });
}

var index = function (page) {
    page = parseInt(page) || 1;
    
    $('title').html(_config.title);
    window.animehub = window.animehub || { reviews: {}, reviewList: {}, aniListToken: '' };

    if (window.animehub.reviewList[page] != undefined) {
        $('#main').html(window.animehub.reviewList[page]);
        return;
    }
    
    getAniListToken({
        success: function (accessToken) {
            window.animehub.aniListToken = accessToken;
            fetchAllReviewList(page);
        },
        error: function (error) {
            printError(error);
        }
    });
}

var detail = function (id) {
    if (!window.animehub) {
        window.animehub = {}
        window.animehub.reviews[id] = {}
    }
    
    if (window.animehub.reviews[id] != undefined) {
        var review = window.animehub.reviews[id];
        $('#main').html(review.html);
        $('title').html(review.data.title + ' - ' + _config.title);
        $('.animehub-ribbon').css("background", "url('" + review.data.banner + "') center / cover");
        return;
    }
    
    // TODO: Fetch and show the detail page when there's no pre-rendered one.
    
    fetchAnimeInfo()
}

var routes = {
    '/': index,
    'review/:id': detail
};

var router = Router(routes);
router.init('/');