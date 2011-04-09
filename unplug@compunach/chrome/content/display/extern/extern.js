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

UnPlug2Extern = {
	watching : [],
	
	add_program_box : (function (download_method, filename) {
		var template = document.getElementById("program-template");
		var container = document.getElementById("program-container");
		var dupe = template.cloneNode(true);
		var labels = dupe.getElementsByTagName("label");
		dupe.setAttribute("collapsed", false);
		dupe.getElementsByTagName("description")[0].setAttribute("value", filename);
		labels[0].setAttribute("value", UnPlug2.str("dmethod." + download_method));
		container.appendChild(dupe);
		this.set_program_box_status(dupe, 0, "running");
		return dupe;
	}),
	
	set_program_box_status : (function (doc, file_size, process_status) {
		var labels = doc.getElementsByTagName("label");
		if (file_size < 2.5 * 1024 * 1024) {
			file_size = (file_size / 1024).toFixed(1) + " KiB";
		} else if (file_size < 2.5 * 1024 * 1024 * 1024) {
			file_size = (file_size / (1024 * 1024)).toFixed(1) + " MiB";
		} else {
			file_size = (file_size / (1024 * 1024 * 1024)).toFixed(1) + " GiB";
		}
		labels[1].setAttribute("value", file_size);
		labels[2].setAttribute("value", UnPlug2.str("proc.status." + process_status));
		doc.className = "process process-status-" + process_status;
	}),
	
	receive_signal_callback : (function () {
		var extern = this;
		return (function (event) {
			/*
			 * IMPORTANT
			 * Anyone can send signals to this window, so it is
			 * vitally important to check the message comes from
			 * privilidged code (chrome).
			 */
			if (event.origin.indexOf("chrome:") != 0) {
				return;
			}
			var msg = window.JSON.parse(event.data);
			var process_list = UnPlug2DownloadMethods.exec_from_signal(msg);
			for (var i = 0; i < process_list.length; ++i) {
				var rtn = process_list[i];
				rtn.node = extern.add_program_box(msg.method, rtn.file.leafName);
				extern.setup_kill_button(rtn);
				extern.watching.push(rtn);
			}
		});
	}),
	
	setup_kill_button : (function (rtn) {
		
		// TODO - we really want a smaller and nicer cancel button
		var that = this;
		
		rtn.node.getElementsByTagName("button")[0].addEventListener("command", (function () {
			// no point in killing if it's already dead
			if (!rtn.process.isRunning) {
				return;
			}
			
			// ask it we want to delete
			// Alt+F4 defaults to POS_1
			var prompt_service = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			var checkbox = { "value" : true };
			var button = prompt_service.confirmEx(window, UnPlug2.str("extern.cancel.title"),
				UnPlug2.str("extern.cancel.onefile").replace("%s", rtn.file.leafName),
				prompt_service.BUTTON_POS_0 * prompt_service.BUTTON_TITLE_IS_STRING +
				prompt_service.BUTTON_POS_1 * prompt_service.BUTTON_TITLE_IS_STRING,
				UnPlug2.str("extern.cancel.stop"), UnPlug2.str("extern.cancel.dontstop"), null,
				UnPlug2.str("extern.cancel.deletefile"),
				checkbox);
			if (button === 0) {
				that.do_kill(rtn, checkbox.value);
			}
		}), false);
	}),
	
	do_kill : (function (rtn, rm_file) {
		if (!rtn.process.isRunning) {
			return; // don't delete if it's just finished.
		}
		rtn.was_killed = true;
		rtn.process.kill();
		if (rm_file) {
			try {
				rtn.file.remove(false);
			} catch (e) {} // file does not exist
		}
	}),
	
	remove_kill_button : (function (doc) {
		var n = doc.getElementsByTagName("button")[0];
		n.style.visibility = "hidden"; // don't delete as has race with kill button setup
	}),
	
	poll : (function () {
		var extern = this;
		// TODO this makes this not threadsafe, we may mess up if we
		// call watching.push() from a different thread.
		extern.watching = extern.watching.filter(function (item, idx, arr) {
			var file_size = 0;
			if (item.file.exists()) {
				file_size = item.file.fileSize;
			}
			if (item.process.isRunning) {
				extern.set_program_box_status(item.node, file_size, "running");
			} else {
				if (item.was_killed || item.process.exitValue) {
					extern.set_program_box_status(item.node, file_size, "error");
				} else if (file_size == 0) {
					// EXIT_SUCCESS + no file is error from vlc
					extern.set_program_box_status(item.node, file_size, "error");
				} else {
					extern.set_program_box_status(item.node, file_size, "done");
				}
				// remove from array
				extern.remove_kill_button(item.node);
				return false;
			}
			return true;
		});
	}),
	
	want_close : (function () {
		if (this.watching.length == 0) {
			return true; // no reason not to exit
		}
		
		var prompt_service = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var checkbox = { "value" : true };
		var button = prompt_service.confirmEx(window, UnPlug2.str("extern.cancel.title"),
			UnPlug2.str("extern.cancel.manyfile").replace("%s", this.watching.length),
			prompt_service.BUTTON_POS_0 * prompt_service.BUTTON_TITLE_IS_STRING +
			prompt_service.BUTTON_POS_1 * prompt_service.BUTTON_TITLE_IS_STRING,
			UnPlug2.str("extern.cancel.stop"), UnPlug2.str("extern.cancel.dontstop"), null,
			UnPlug2.str("extern.cancel.deletefile"),
			checkbox);
		if (button === 0) {
			for (var i = 0; i < this.watching.length; ++i) {
				this.do_kill(this.watching[i], checkbox.value);
			}
			return true; // ok to exit
		} else {
			return false; // clicked cancel
		}
	})
}

window.addEventListener("load", (function () {window.loaded = true;}), false);
window.addEventListener("message", UnPlug2Extern.receive_signal_callback(), false);
window.setInterval((function () { UnPlug2Extern.poll() }), 3000);


