(function () {
	var domSerializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
		.createInstance(Components.interfaces.nsIDOMSerializer);

	var response = [];
	function data_for_window(win) {
		response.push{
			"url" : win.location.href,
			"html" : domSerializer.serializeToString(win.document),
		}

		// iterate (recursively) through iframes
		for (var i = 0; i < win.frames.length; i++) {
			data_for_window(win.frames[i]);
		} 
	}

	data_for_window(content);
	sendAsyncMessage("unplug:gethtml", response);
})();
