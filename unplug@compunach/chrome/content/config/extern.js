/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2010, 2011 David Batley <unplug@dbatley.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var get_config_name = (function () {
	return (window.arguments && window.arguments[0]) || "ERROR";
});

var is_valid_file = (function (fname) {
	try {
		var f = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		f.initWithPath(fname);
		return (f.exists() && f.isExecutable());
	} catch (e) {
		// initWithPath on windows for "/usr/bin/..." raises error
		return false;
	}
});

var onload = (function () {
	var config_name = get_config_name();
	var config_info = UnPlug2DownloadMethods.getinfo(config_name);
	
	var setup_dialog = (function () {
		document.getElementById("need-to-install").setAttribute("value",
			UnPlug2.str("need_to_install").replace("%s", UnPlug2.str("dmethod." + config_name)));
		document.getElementById("location-of").setAttribute("value",
			UnPlug2.str("location_of").replace("%s", UnPlug2.str("dmethod." + config_name)));
		if (config_info && config_info.weblinks) {
			var linkbox = document.getElementById("link-box");
			for (var i = 0; i < config_info.weblinks.length; ++i) {
				var l = document.createElement("label");
				l.className = "text-link";
				l.setAttribute("href", config_info.weblinks[i].url);
				l.setAttribute("value", config_info.weblinks[i].label);
				linkbox.appendChild(l);
			}
		}
	});
	var search_usual_places = (function () {
		var value = UnPlug2.get_pref("dmethod." + config_name) || "";
		document.getElementById("execfile").value = "";
		if (value && is_valid_file(value)) {
			document.getElementById("execfile").value = value;
		} else {
			if (config_info && config_info.exec_file_list) {
				for (var i = 0; i < config_info.exec_file_list.length; ++i) {
					if (is_valid_file(config_info.exec_file_list[i])) {
						document.getElementById("execfile").value = config_info.exec_file_list[i];
						break;
					}
				}
			}
		}
		document.getElementById("execfile").disabled = false;
		document.getElementById("browsebutton").disabled = false;
	});
	setup_dialog();
	window.setTimeout(search_usual_places, 2);
});
window.addEventListener("load", onload, false);

var onaccept = (function () {
	var config_name = get_config_name();
	var elem = document.getElementById("execfile");
	if (!elem.value || is_valid_file(elem.value)) {
		UnPlug2.set_pref("dmethod." + config_name, elem.value);
	} else {
		alert("Not an executable file: " + elem.value);
		elem.focus();
		return false; // inhibit closing of page
	}
});


var dobrowse = (function () {
	var config_name = get_config_name();
	var title = UnPlug2.str("location_of").replace("%s", UnPlug2.str("dmethod." + config_name));
	var filepicker = Components.classes["@mozilla.org/filepicker;1"]
		.createInstance(Components.interfaces.nsIFilePicker);
	filepicker.init(window, title, Components.interfaces.nsIFilePicker.modeOpen);
	
	var ret = filepicker.show()
	if (ret == Components.interfaces.nsIFilePicker.returnOK) {
		document.getElementById("execfile").value = filepicker.file.path;
	}
});

