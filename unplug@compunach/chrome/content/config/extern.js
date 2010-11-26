/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2010 David Batley <unplug@dbatley.com>
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

var config_name = "rtmpdump"; // TODO should be set from window.arguments

var is_valid_file = (function (fname) {
	var f = Components.classes["@mozilla.org/file/local;1"]
		.createInstance(Components.interfaces.nsILocalFile);
	f.initWithPath(fname);
	return (f.exists() && f.isExecutable());
});

var onload = (function () {
	var value = UnPlug2.get_pref("dlmethod." + config_name) || "";
	document.getElementById("execfile").value = "";
	if (value && is_valid_file(value)) {
		document.getElementById("execfile").value = value;
	} else {
		var config_info = UnPlug2DownloadMethods.getinfo(config_name);
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

var onaccept = (function () {
	var elem = document.getElementById("execfile");
	if (!elem.value || is_valid_file(elem.value)) {
		UnPlug2.set_pref("dlmethod." + config_name, elem.value);
	} else {
		alert("Not an executable file: " + elem.value);
		elem.focus();
		return false; // inhibit closing of page
	}
});


var dobrowse = (function () {
	var filepicker = Components.classes["@mozilla.org/filepicker;1"]
		.createInstance(Components.interfaces.nsIFilePicker);
	filepicker.init(window, "Location of progam",
		Components.interfaces.nsIFilePicker.modeOpen);
	
	var ret = filepicker.show()
	if (ret == Components.interfaces.nsIFilePicker.returnOK) {
		document.getElementById("execfile").value = filepicker.file.path;
	}
});
