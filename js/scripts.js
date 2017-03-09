/* global Xbmc */
/* global $ */
/* global Mousetrap */
/* global Hammer */
var chowder = {}, c,
	onlineStatus = false,
	defaulthost = '192.168.1.105',
	nowPlayingData = {}, systemEventData = {},
	trackpadListener, mouse = new Mousetrap();
var is_touch_device = 'ontouchstart' in document.documentElement;

window.Xbmc.DEBUG = (document.location.hash === "#debug");

if (!window.localStorage) {
	window.localStorage = {
	  _data       : {},
	  setItem     : function(id, val) { return this._data[id] = String(val); },
	  getItem     : function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : undefined; },
	  removeItem  : function(id) { return delete this._data[id]; },
	  clear       : function() { return this._data = {}; }
	};
};

$(document).ready(function () {
	chowder.settings.load();
	chowder.init();
});


/*		METHODS		*/


chowder = {
	send_msg: function (method, params) {
		if (!window.c||!window.c.call) { return false; }
		var msg = {
			"jsonrpc": "2.0",
			"method": method,
			"id": method
		};
		if (params) { msg.params = params; }
		c.call(JSON.stringify(msg));
	},
	getHostname: function () {
		return window.localStorage.getItem("cchost") || defaulthost;
	},
	setHostname: function (host) {
		window.localStorage.setItem("cchost", host);
		$("#hostname").val(host);
	},
	setStatus: function (text, color) {
		var status = $(".status");
		status
			.removeClass("status-offline status-online status-fail")
			.addClass(color);

		if (text === "online") {
			status.text(chowder.getHostname());
		} else {
			status.text(text);
		}
	},
	init: function () {
		c = new window.Xbmc.Controller({
			host: chowder.getHostname(),
			onInit: function () {
				bindings();
				dumpToConsole("using host: ", chowder.getHostname());
			},
			onFail: function () {
				window.dumpToConsole('XBMC Fail');
				onlineStatus = false;
				chowder.setStatus("failed", "status-fail");
			},
			onOnline: function () {
				window.dumpToConsole('XBMC Online');
				onlineStatus = true;
				chowder.setStatus("online", "status-online");
				chowder.bindInputEvents();
				/*chowder.bindListeners();*/
			},
			onOffline: function () {
				window.dumpToConsole('XBMC Offline');
				onlineStatus = false;
				chowder.setStatus("offline", "status-offline");
			}
		});
	},
	bindListeners: function() {
		
		c.subscribe('Player.OnPlay', function(data) {
			chowder.send_msg('Player.GetActivePlayers');
			
		});

		c.subscribe('Player.GetActivePlayers', function(data) {
			console.log("Player.GetActivePlayers", data);
			var r = data.result[0];
			if (r.type = 'video') {
				chowder.send_msg('Player.GetItem', {
					"properties": ["file", "streamdetails"],
					"playerid": r.playerid,
				});
			}
		});
		
		c.subscribe('Player.GetItem', function(data) {
			var r = data.result.item;
			console.log("Playing Video", r.label);
			console.log("File", r.file);
			//var v = r.streamdetails.video[0];
		});
		
		/*
		c.subscribe('Player.OnStop', function(data) {
			console.log("Stopped");
		});
		*/
		c.subscribe('Player.OnPause', function(data) {
			console.log("Paused", data||{});
		});
	},
	bindInputEvents: function() {
		c.subscribe('Input.OnInputRequested', function(data) {
			var value = "", title = "";
			if (data["title"] !== undefined) { title = data["title"]; }
			else { title = "Enter Text"; }

			if (data["value"] !== undefined) { value = data["value"]; }

			var t = prompt(title, value);
			if (t && t.length > 0) {
				c.Input.SendText({"text": t, "done": false});
			}
		});

		/*
		c.subscribe('Input.OnInputFinished', function(data) {});
		*/
	},
	bindKeyEvents: function (d) {
		dumpToConsole("keypress", d);
		if (("keyIdentifier" in d) && $("#remoteTab").is(".active")) {
			switch (d.keyIdentifier) {
				case "Up":
					c.Input.Up(); break;
				case "Down":
					c.Input.Down(); break;
				case "Left":
					c.Input.Left(); break;
				case "Right":
					c.Input.Right(); break;
				case "U+001B":
					c.Input.Back(); break;
				case "U+0048":
					c.Input.Home(); break;
				case "Enter":
					c.Input.Select(); break;
				case "U+0049":
					c.Input.Info(); break;
				case "U+0043":
					c.Input.ContextMenu(); break;
				default:
					dumpToConsole("keypress: ", d.keyIdentifier); break;
			};
		}
	},
	bindings: {
		reset: function () { window.Mousetrap.reset(); },
		keyboard: function () {
			mouse.bind('up', function () { c.Input.Up(); });
			mouse.bind('down', function () { c.Input.Down(); });
			mouse.bind('left', function () { c.Input.Left(); });
			mouse.bind('right', function () { c.Input.Right(); });
			mouse.bind('escape', function () { c.Input.Back(); });
			mouse.bind('enter', function () { c.Input.Select(); });
			mouse.bind('h', function () { c.Input.Home(); });
			mouse.bind('i', function () { c.Input.Info(); });
			mouse.bind('c', function () { c.Input.ContextMenu(); });
			mouse.bind('o', function () { c.Input.ShowOSD(); });
			mouse.bind('f', function () { c.GUI.SetFullscreen({"fullscreen":"toggle"}); });
			dumpToConsole("initialized keyboard bindings");
		},
		trackpad: function () {
			if (!is_touch_device) {
				$("#trackpad").text("keyboard active");
				return false;
			}
			var trackpad = document.getElementById('trackpad');
			trackpadListener = new window.Hammer(trackpad, {});
			var doubletap = new window.Hammer.Tap({ event: "doubletap", taps: 2 });
			var singletap = new window.Hammer.Tap({ event: "tap", taps: 1 });
			trackpadListener.add([doubletap, singletap]);
			doubletap.recognizeWith(singletap);
			singletap.requireFailure(doubletap);
			trackpadListener.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
			trackpadListener.on("swipeleft swiperight swipeup swipedown doubletap tap hold", function (ev) {
				trackpad.textContent = ev.type;
				switch (ev.type) {
					case "swipeleft":
						c.Input.Left(); break;
					case "swiperight":
						c.Input.Right(); break;
					case "swipeup":
						c.Input.Up(); break;
					case "swipedown":
						c.Input.Down(); break;
					case "doubletap":
						c.Input.Back(); break;
					case "tap":
						c.Input.Select(); break;
					case "hold":
						c.Input.ContextMenu(); break;
				}
			});
			dumpToConsole("trackpad bindings successfull");
		}
	}
};
chowder.settings = {
	save: function () {
		dumpToConsole("saving...");
		var newVal = $("#hostname").val();
		chowder.setStatus("offline", "status-offline");
		if (newVal.length < 2) {
			alert("new hostname not valid!");
			return false;
		} else {
			chowder.setHostname(newVal);
			chowder.init();
		}
	},
	load: function () {
		var h = chowder.getHostname();
		$("#hostname").val(h);
		chowder.setHostname(h);
	}
};
/*		EVENTS 		*/
$(function () {

	$('#resetButton').on('click', function () {
		window.localStorage.removeItem("cchost");
		alert("reset complete, reloading..");
		window.location.reload();
	});

	$('a[href=#remote]').on('shown.bs.tab', function (e) {
		mouse.unpause();
	});

	$('a[href=#remote]').on('hidden.bs.tab', function (e) {
		mouse.pause();
	});

	$("#saveButton").on("click", function () {
		chowder.settings.save();
	});

	$("#castButton").on("click", function () {
		var urlElement, castbtn, castStatus, urlval, i = {};		
		urlElement = $("#castUrl");
		castbtn = $(this);
		castStatus = $("#castStatus");
		urlval = urlElement.val();
		castbtn.removeClass("success");
		castStatus.toggleClass("fa-play fa-refresh fa-spin");

		if (urlval.length < 1) {
			dumpToConsole("no cast url", "error");
			castStatus.toggleClass("fa-play fa-refresh fa-spin");
			urlElement.focus().attr("placeholder", "Please enter a URL!");
			return false;
		}
		i.item = {};
		i.item.file = urlval;

		c.Player.Open(i, function() {
			castStatus.toggleClass("fa-play fa-refresh fa-spin");
		}, function() {
			castStatus.toggleClass("fa-play fa-refresh fa-spin");
			alert("Error casting URL!");
		});
	});


	$(".homeButton").on("click", function() {
		c.Input.Home();
	});
	
	$(".infoButton").on("click", function() {
		c.Input.Info();
	});

	$(".fullscreenButton").on("click", function() {
		c.GUI.SetFullscreen({"fullscreen":"toggle"});
	});
	
	
	$(".playButton").on("click", function () {
		c.Player.PlayPause({ "playerid": 1 });
	});

	$(".stopButton").on("click", function () {
		c.Player.Stop({ "playerid": 1 });
	});

	$(".status").on("click", function () {
		$('a[href=#settings]').parent('li').toggle();
	});

	$(".stepForward").on("click", function() {
		c.Input.ExecuteAction({"action": "stepforward"});
	});
	$(".stepBack").on("click", function() {
		c.Input.ExecuteAction({"action": "stepback"});
	})

});


chowder.tools = {
	hasActivePlayer: function () {
		var hasobj = {};
		c.Player.GetActivePlayers({}, function(){
			console.log("true");
		}, function() {
			console.log("false");
		});
	},
	escapeEncode: function (t) {
		return encodeURIComponent(t).replace(/'/g, "%27").replace(/"/g, "%22");
	}
};


/*		FUNCTIONS		*/
function bindings() {
	if (Xbmc.DEBUG)
		dumpToConsole("DEBUG MODE ENABLED");

	chowder.bindings.keyboard();
	mouse.pause();
	chowder.bindings.trackpad();
}

var dumpToConsole = function (text, obj) {
	if (Xbmc.DEBUG && text && text.length) {
		if (!obj) {
			console.log("... event: " + text);
		} else {
			console.log("... event: " + text, obj);
		}
	}
};

var onSystemEvent = function (obj) {
	if (obj.length && obj.event.length && obj.data.length) {
		switch (obj.event) {
			case "play":
				window.nowPlayingData = obj.data;
				dumpToConsole("Movie Played", obj.data.item.title);
				break;
			default:
				window.systemEventData = obj.data;
				break;
		}
	}
};


