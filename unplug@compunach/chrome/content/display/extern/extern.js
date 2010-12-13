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
		file_size = (file_size / (1024 * 1024)).toPrecision(2) + " MiB";
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
			var rtn = UnPlug2DownloadMethods.exec_from_signal(msg);
			if (rtn) {
				rtn.node = extern.add_program_box(msg.name, rtn.file.leafName);
				extern.setup_kill_button(rtn);
				extern.watching.push(rtn);
			}
		});
	}),
	
	setup_kill_button : (function (rtn) {
		rtn.node.getElementsByTagName("button")[0].addEventListener("command", (function () {
			rtn.was_killed = true;
			rtn.process.kill();
		}), false);
	}),
	
	remove_kill_button : (function (doc) {
		var n = doc.getElementsByTagName("button")[0];
		n.parentNode.removeChild(n);
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
		if (this.watching.length > 0) {
			return confirm("Current downloads will no longer be listed if you close this window.");
		}
		return true;
	})
}

window.addEventListener("message", UnPlug2Extern.receive_signal_callback(), false);
window.setInterval((function () { UnPlug2Extern.poll() }), 3000);


