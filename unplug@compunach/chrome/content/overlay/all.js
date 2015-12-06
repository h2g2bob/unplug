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


/**
 * Things the overlay needs, such as opening the popup window.
 */
UnPlug2Overlay = {
	// TODO: we could use window.removeEventListener instead
	have_loaded_browser : false,

	// popup window (if not closed) from last button click
	_popup_window_ref : null,
	
	/**
	 * Run a search (by opening a popup window and giving it the page to work with)
	 */
	run : function () {
		var brtab = this.get_current_brtab();
		var mm = brtab.messageManager;
		mm.addMessageListener("unplug:gethtml", this.mm_callback, false);
		mm.loadFrameScript('chrome://unplug/content/webpagecontext/gethtml.js', false);
	},

	mm_callback : function (ev) {
		try {
			// close previous popup window
			try {
				UnPlug2Overlay._popup_win_ref.close();
			} catch(e) {
				// pass
			}
			UnPlug2Overlay._popup_win_ref = window.openDialog("chrome://unplug/content/display/pop/pop.xul", "unplug_window", "chrome,centerscreen", ev.data);
			UnPlug2Overlay._popup_win_ref.focus();
		} catch (e) {
			UnPlug2.log(e.toSource());
		}
	},
	
	/**
	 * Function which is called once, when chrome://browser has finished loading.
	 * This removes the items from menus which we don't care about.
	 */
	browser_loaded : function () {
		var menus = [ "toolsmenu", "contextmenu", "addonsbar" ];
		for (var i = 0 ; i < menus.length; i++) {
			var name = menus[i];
			try {
				if ( ! UnPlug2.get_pref("add_to_" + name, true) ) {
					var el = window.document.getElementById("unplug2_" + name)
					el.collapsed = true;
				}
			} catch(e) {
				UnPlug2.log("Error removing " + name + " because " + e.toSource());
			}
		}
		
		// check if we've set up everthing we need to (eg: installed toolbar button, etc)
		if (UnPlug2.get_pref("setup_number", 0) < UnPlug2.setup_number) {
			window.setTimeout((function () {
				window.openDialog("chrome://unplug/content/config/config.xul", "", "", "setup");
				}), 1000);
		}
	},
	
	/**
	 * Function which is called each time a page is loaded
	 */
	page_loaded : function () {
		if ( !this.have_loaded_browser ) {
			this.browser_loaded();
			this.have_loaded_browser = true;
		}
	},
	
	/**
	 * Returns the window in the curently open tab
	 */
	get_current_brtab : function () {
		var br = getBrowser();
		var br_tab = br.getBrowserAtIndex(br.mTabContainer.selectedIndex);
		if (!br_tab) {
			// can happen for pop-up windows, eg: pop-out radio player
			UnPlug2.log("overlay.get_current_brtab() assuming tab 0 because selectedIndex is " + br.mTabContainer.selectedIndex);
			br_tab = br.getBrowserAtIndex(0);
		}
		return br_tab;
	},
	
	toString : function () {
		return "<js:UnPlug2Overlay>";
	},
	
	version : 2.0 };

window.addEventListener("load", function () { UnPlug2Overlay.page_loaded(); }, false);

