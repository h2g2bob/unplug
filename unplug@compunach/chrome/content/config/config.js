/*
 *         _        ___
 *    /\ / /___    / _ \ /\ /\  _ ___
 *   / // // _ \  / // // // // // _ \
 *  / // // // / / ___// // // // // /
 *  \___//_//_/ /_/   /_/ \___/ \_  /
 *                             \___/
 * 
 *  Compunach UnPlug
 *  Copyright (C) 2009 David Batley <unplug@dbatley.com>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 2 of the License, or
 *  (at your option) any later version.
 * 
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 * 
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

function do_load() {
	if (window.arguments && window.arguments.length >= 1) {
		if (window.arguments[0] == "setup") {
			setup_unplug();
		}
	}
	populate_configs();
	detect_toolbarbutton();
	goto_tab_requested()
}

function populate_configs() {
	var elemlist = document.getElementsByTagName("configwrapper");
	for (var i = 0; i < elemlist.length; i++) {
		var el = elemlist[i];
		var value = UnPlug2.get_pref(el.getAttribute("name"), el.getAttribute("default"));
		el.setValue(value);
	}
	document.getElementById("version").setAttribute("value", "Version: " + UnPlug2.version.toFixed(3) + " (" + UnPlug2.codename + ") " + UnPlug2.revision);
}

function browser_window() {
	var w = window;
	while (!w.getBrowser) {
		w = w.opener;
		if (!w)
			return null;
	}
	return w;
}

function detect_toolbarbutton() {
	var w = browser_window()
	if (!w)
		return;
	var toolbarbutton = w.document.getElementById("unplug2_toolbarbutton");
	var checkbox = document.getElementById("add_toolbar_button");
	checkbox.checked = (toolbarbutton != null) ? true : false;
	checkbox.disabled = false;
}

function toggle_toolbarbutton() {
	var w = browser_window()
	if (!w)
		return;
	var toolbarbutton = w.document.getElementById("unplug2_toolbarbutton");
	if (toolbarbutton) {
		var navtoolbar = w.document.getElementById("nav-bar");
		// do persist thing (applies next restart)
		var curSet = navtoolbar.currentSet;
		if (curSet) {
			if (curSet.indexOf("urlbar-container") < 0 && curSet.indexOf("search-container") < 0) {
				alert("There's a problem removing the toolbar button\n\n" + curSet);
			} else {
				navtoolbar.setAttribute("currentset", curSet.replace(",unplug2_toolbarbutton", ""));
				w.document.persist("nav-bar","currentset");
			}
		} else {
			alert("Persist failed - cannot remove toolbar button");
		}
		// remove button (applies this session)
		navtoolbar.removeChild(toolbarbutton);
	} else {
		var navtoolbar = w.document.getElementById("nav-bar");
		// do persist thing (applies next restart)
		var curSet = navtoolbar.currentSet;
		if (curSet) {
			if (curSet.indexOf("urlbar-container") < 0 && curSet.indexOf("search-container") < 0) {
				alert("There's a problem adding the toolbar button\n\n" + curSet);
			} else {
				navtoolbar.setAttribute("currentset", curSet + ",unplug2_toolbarbutton");
				w.document.persist("nav-bar","currentset");
			}
		} else {
			alert("Persist failed - cannot add toolbar button");
		}
		// add button (applies this session)
		navtoolbar.insertItem("unplug2_toolbarbutton", null, null, false);
	}
}


function save_configs() {
	var elemlist = document.getElementsByTagName("configwrapper");
	for (var i = 0; i < elemlist.length; i++) {
		var el = elemlist[i];
		var value = UnPlug2.set_pref(el.getAttribute("name"), el.getValue());
	}
}

function goto_tab_requested() {
	if (window.arguments && window.arguments.length >= 1)
		goto_tab(window.arguments[0]);
}

function goto_tab(tabname) {
	var tb = document.getElementById("tabbox");
	switch (tabname) {
		case "welcome":
		case "setup":
			tb.selectedIndex = 3;
			break;
		case "main":
			tb.selectedIndex = 0;
			break;
		case "downloader":
			tb.selectedIndex = 1;
			break;
	}
}

/*
 * This function is called once, to set up unplug
 */
function setup_unplug() {
	// check if we've set up everthing we need to (eg: installed toolbar button, etc)
	switch (UnPlug2.get_pref("setup_number", 0)) {
		case 0:
			if (!detect_toolbarbutton())
				toggle_toolbarbutton();
			UnPlug2.set_pref("setup_number", 1);
			break;
		default:
			UnPlug2.log("Unknown setup_number " + UnPlug2.get_pref("setup_number", 0));
			break;
	}
	
	// show setup complete message
	document.getElementById("setup_complete").style.display = "block";
}



