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

function do_load() {
	if (window.arguments && window.arguments.length >= 1) {
		if (window.arguments[0] == "setup") {
			setup_unplug();
		}
	}
	set_text();
	set_extern_tools();
	detect_toolbarbutton();
	goto_tab_requested();
	setup_restart_notices();
	populate_version();
}

function set_text() {
	document.getElementById("dmethod-saveas").setAttribute("label", UnPlug2.str("dmethod.saveas"))
	document.getElementById("dmethod-openover").setAttribute("label", UnPlug2.str("dmethod.open-over"))
}

function populate_version() {
	var version_str = "UnPlug " + UnPlug2.version.toFixed(3) + " " + UnPlug2.codename + " (" + UnPlug2.revision + ")";
	document.getElementById("version").setAttribute("value", version_str);
}

function set_extern_tools() {
	var names = UnPlug2DownloadMethods.get_extern_tool_names();
	var elem = document.getElementById("extern-tool");
	for (var i = 0; i < names.length; ++i) {
		elem.appendItem(UnPlug2.str("dmethod." + names[i]), names[i]);
	}
	elem.selectedIndex = 0;

	var elem = document.getElementById("allowviaproxy");
	if (UnPlug2.get_pref("allow_external_via_proxy") == false) {
		if (UnPlug2.get_root_pref("extensions.torbutton.banned_ports", null) !== null) {
			// don't allow enabling of this while using tor.
			elem.disabled = true;
		}
	}
}

function edit_extern_tool() {
	var elem = document.getElementById("extern-tool");
	var name = elem.selectedItem.value;
	window.openDialog("chrome://unplug/content/config/extern.xul", "chrome,modal", "unplug_extern", name);
}

function browser_window() {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	var w = wm.getMostRecentWindow("navigator:browser");
	return w;
}

function detect_toolbarbutton() {
	var w = browser_window()
	if (!w)
		return;
	var tbl = w.document.getElementsByTagName("toolbar");
	var have_btn = false;
	for (var i = 0; i < tbl.length; ++i) {
		if (tbl[i].currentSet.split(",").indexOf("unplug2_toolbarbutton") >= 0) {
			have_btn = true;
			break;
		}
	}
	var checkbox = document.getElementById("add_toolbar_button");
	checkbox.checked = have_btn;
	checkbox.disabled = false;
}

function toggle_toolbarbutton() {
	var w = browser_window()
	if (!w)
		return;
	var tbl = w.document.getElementsByTagName("toolbar");
	var have_btn = false;
	for (var i = 0; i < tbl.length; ++i) {
		if (tbl[i].currentSet.split(",").indexOf("unplug2_toolbarbutton") >= 0) {
			// remove button
			var updatedset = tbl[i].currentSet.split(",").filter(function (x) {
				return x != "unplug2_toolbarbutton";
			}).join(",");
			tbl[i].setAttribute("currentset", updatedset);
			w.document.persist(tbl[i].getAttribute("id"),"currentset");
			return;
		}
	}
	
	var navtoolbar = w.document.getElementById("nav-bar");
	if (!navtoolbar || navtoolbar.currentSet.indexOf(",") < 0) {
		alert("Cannot add - where's nav-bar?");
		return;
	}
	// add button
	navtoolbar.setAttribute("currentset", navtoolbar.currentSet + ",unplug2_toolbarbutton");
	w.document.persist(navtoolbar.getAttribute("id"),"currentset");
}

function goto_tab_requested() {
	if (window.arguments && window.arguments.length >= 1)
		goto_tab(window.arguments[0]);
}

function goto_tab(tabname) {
	var pwin = document.getElementById("cn_unplug2_config");
	var p = null;
	switch (tabname) {
		case "welcome":
		case "setup":
			p = document.getElementById("tababout");
			break;
		case "main":
			p = document.getElementById("tabgeneral");
			break;
		case "downloader":
			p = document.getElementById("tabdownload");
			break;
	}
	pwin.showPane(p);
}

function setup_restart_notices() {
	var showpopup = (function () {
		var box = document.getElementById("integration_notification");
		var notification = box.getNotificationWithValue("restart-needed");
		if (!notification) {
			var buttons = [{
				accessKey : "R",
				callback : restart_firefox,
				label : "Restart",
				popup : null }];
			box.appendNotification(
				"Restart firefox to apply these changes",
				"restart-needed",
				"chrome://browser/skin/Info.png",
				box.PRIORITY_WARNING_MEDIUM,
				buttons);
		}
	});
	var el = document.getElementsByClassName("needs_restart");
	for (var i = 0; i < el.length; ++i) {
		el[i].addEventListener("command", showpopup, false);
	};
}

function restart_firefox() {
	// Like chrome://mozapps/content/extensions/extensions.js
	const nsIAppStartup = Components.interfaces.nsIAppStartup;
	Components.classes["@mozilla.org/toolkit/app-startup;1"]
		.getService(nsIAppStartup)
		.quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
}

/*
 * This function is called once, to set up unplug
 */
function setup_unplug() {
	// check if we've set up everthing we need to (eg: installed toolbar button, etc)
	switch (UnPlug2.get_pref("setup_number", 0)) {
		case 0:
			/* We're adding ourselves to the add-ons bar,
			 * so this is less important. We'll skip it by default:
			if (!detect_toolbarbutton())
				toggle_toolbarbutton();
			*/
			UnPlug2.set_pref("setup_number", 1);
			break;
		default:
			UnPlug2.log("Unknown setup_number " + UnPlug2.get_pref("setup_number", 0));
			break;
	}
	
	// show setup complete message
	document.getElementById("setup_complete").style.display = "block";
}



