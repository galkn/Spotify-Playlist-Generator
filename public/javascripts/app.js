$(function() {
	function log() {
		console.log(log.arguments);
	}
	
	function uuid() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		    return v.toString(16);
		});
	}
	
	var last_fm_api_key = "db0d871a0f03595310898fea74a60d5b";
	
	window.similarSongsInOrderedList = [];
			
	var Song = Backbone.Model.extend({
		defaults: {
			track: "",
			artist: "",
			url: "",
			playcount: 0,
			match: 1,
			image: [],
			duration: 0,
			similarSongs: [],
		
			score: 0,
			weight: 1,
			getData: false
		},
		initialize: function() { var self = this;
			this.set({uuid: uuid()});
			
			if(self.get("getData")) {
				$.getJSON("http://ws.audioscrobbler.com/2.0/", {
					method: "track.getInfo",
					artist: self.get("artist"),
					track: self.get("track"),
					api_key: last_fm_api_key,
					format: "json"
				}, function(data) {
					self.set(data.track);
				});
			}
			
		},
		findSimilar: function(isEndOfList) { var self = this;
			$.getJSON("http://ws.audioscrobbler.com/2.0/", {
				method: "track.getsimilar",
				artist: self.get("artist"),
				track: self.get("track"),
				api_key: last_fm_api_key,
				format: "json"
			}, function(data) {
				var numberOfSimilarTracksToFind = 50;
				
				data.similartracks.track = _.first(data.similartracks.track, numberOfSimilarTracksToFind);
								
				var similarSongsList = new SongList(data.similartracks.track);
				self.set({similarSongs: similarSongsList});
			
				for(var i in similarSongsList.models) {
					var score = (numberOfSimilarTracksToFind-i) * parseInt(self.get("weight"));
					var listUpdated = false;
				
					for(var j in similarSongsInOrderedList) {
						if(similarSongsList.models[i].get("url") == similarSongsInOrderedList[j].get("url")) {
							similarSongsInOrderedList[j].set({score: similarSongsInOrderedList[j].get("score") + score})
						
							similarSongsInOrderedList = _.sortBy(similarSongsInOrderedList, function(song){ 
								return song.get("score");
							});
						
							listUpdated = true;
						}
					}
				
					if(!listUpdated) {
						similarSongsList.models[i].set({score: score});
						similarSongsInOrderedList.push(similarSongsList.models[i]);
					
						similarSongsInOrderedList = _.sortBy(similarSongsInOrderedList, function(song){ 
							return song.get("score");
						});							
					}						
				}
				
				
			
				if(isEndOfList) {
					window.similarSongsInOrderedList = _.reject(similarSongsInOrderedList, function(song){ 
						return song.get("name") == "undefined" || 
							   song.get("name") == undefined || 
							   !song.get("name") || 
							   typeof song.get("name") === "undefined";
					});
					
					for(var i in window.songList.models) {
						var songInSongList = window.songList.models[i];
						
						//window.similarSongsInOrderedList = _.reject(similarSongsInOrderedList, function(song){ 
							//return song.get("url") != songInSongList.get("url");
						//});
						
						if(window.songList.models.length-1 == i) {
							window.similarSongsInOrderedList = window.similarSongsInOrderedList.reverse();
							
							log(similarSongsInOrderedList);
							
							var song_counter = 0;
							var song_ids = [];
							for(var j=0; j<50; j++) {
								song_counter++;
								
								log(window.similarSongsInOrderedList[j]);
								
								$.getJSON("http://ws.spotify.com/search/1/track.json", {
									q: window.similarSongsInOrderedList[j].get("name") + " " + window.similarSongsInOrderedList[j].get("artist").name
								}, function(data) { 
									song_counter--;
									
									if(data.tracks) {
										if(data.tracks[0]) {
											song_ids.push(data.tracks[0].href.replace("spotify:track:", ""));
										}
									}

									log(song_ids);
									
									if(song_counter == 0) {
										$("body").append('<iframe src="https://embed.spotify.com/?uri=spotify:trackset::' + song_ids.join(",") + '" frameborder="0" allowtransparency="true" width="720" height="640"></iframe>');
										log(new Date());	
									}
								});
							}
						}
					}
				}
			});
		}
	});
		
	var SongList = Backbone.Collection.extend({
		
		model: Song,
				
		generateRecomendedSongsList: function() { var self = this;
			for(var i in this.models) { 
				this.models[i].findSimilar( this.models.length-1 == i );
			}
		}
		
	});
	window.songList = new SongList([		
		new Song({artist: "david guetta", track: "little bad girl"}),		
		new Song({artist: "nicki minaj", track: "starships"}),		
		new Song({artist: "skrillex", track: "bangarang"}),		
		new Song({artist: "dev", track: "in the dark"}),		
		new Song({artist: "la roux", track: "bulletproof"}),		
		new Song({artist: "oh land", track: "sun of a gun"}),		
		new Song({artist: "cobra starship", track: "you make me feel"}),		
		]);
		window.songList.generateRecomendedSongsList();
	
	var LookupSimilarSongsFormView = Backbone.View.extend({
		el: "#lookup_similar_songs_form",
		events: {
			"submit": "addSong",
			"focus #artist": "clearDefaultInputFieldValueOfArtist",
			"focus #track": "clearDefaultInputFieldValueOfTrack",
			"blur #artist": "restoreDefaultInputFieldValueOfArtist",
			"blur #track": "restoreDefaultInputFieldValueOfTrack",
			"keyup #track": "autoCompleteSong",
			"click #autocompleted_name": "autoFillTrackAndArtistNAmes",
			"click #autocompleted_artist": "autoFillTrackAndArtistNAmes",
		},
		autoFillTrackAndArtistNAmes: function() {
			this.$el.find("#artist").val($("#autocompleted_artist").text());
			this.$el.find("#track").val($("#autocompleted_name").text());
		},
		autoCompleteSong: function(el) { var self = this;
			if(el.srcElement.value.length > 2) {
				$.getJSON("http://ws.audioscrobbler.com/2.0/", {
					method: "track.search",
					track: el.srcElement.value,
					api_key: last_fm_api_key,
					format: "json"
				}, function(data) { data = data.results;
					self.$el.find("#autocompleted_name").text( data.trackmatches.track[0].name);
					self.$el.find("#autocompleted_artist").text( data.trackmatches.track[0].artist);
				});
			}
		},
		restoreDefaultInputFieldValueOfArtist: function(el) {
			if($(el.srcElement).val() === "") $(el.srcElement).val("Artist");
		},
		restoreDefaultInputFieldValueOfTrack: function(el) {
			if($(el.srcElement).val() === "") $(el.srcElement).val("Track");
		},
		clearDefaultInputFieldValueOfArtist: function(el) { 
			if($(el.srcElement).val() === "Artist") $(el.srcElement).val("");
		},
		clearDefaultInputFieldValueOfTrack: function(el) { 
			if($(el.srcElement).val() === "Track") $(el.srcElement).val("");
		},
		addSong: function(e) {
			e.preventDefault();
			
			window.songList.add(new Song({
				track: $("#track").val(), 
				artist: $("#artist").val(),
				getData: true
			}));
			
			if(_.size(window.songList) > 1) songList.generateRecomendedSongsList();
						
			return false;
		}
	});
	window.lookupSimilarSongsFormView = new LookupSimilarSongsFormView;
			
	log(new Date());
	
});