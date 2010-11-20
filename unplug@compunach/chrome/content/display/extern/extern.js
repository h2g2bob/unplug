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
		labels[0].setAttribute("value", filename);
		labels[1].setAttribute("value", UnPlug2.str("dmethod." + download_method));
		container.appendChild(dupe);
		this.set_program_box_status(dupe, 0, "Loading");
		return dupe;
	}),
	
	set_program_box_status : (function (doc, file_size, process_status) {
		var labels = doc.getElementsByTagName("label");
		file_size = (file_size / (1024 * 1024)).toPrecision(2) + " MiB";
		labels[2].setAttribute("value", file_size);
		labels[3].setAttribute("value", process_status);
	}),
	
	receive_signal_callback : (function () {
		var extern = this;
		return (function (event) {
			if (event.origin.indexOf("chrome:") != 0) {
				return;
			}
			var msg = window.JSON.parse(event.data);
			var rtn = UnPlug2DownloadMethods.exec_from_signal(msg);
			if (rtn) {
				rtn.node = extern.add_program_box(msg.name, rtn.file.leafName);
				extern.watching.push(rtn);
			}
		});
	}),
	
	poll : (function () {
		var extern = this;
		extern.watching.filter(function (item, idx, arr) {
			var file_size = 0;
			if (item.file.exists()) {
				file_size = item.file.fileSize;
			}
			if (item.process.isRunning) {
				extern.set_program_box_status(item.node, file_size, "Running");
			} else {
				if (item.process.exitValue) {
					extern.set_program_box_status(item.node, file_size, "Error");
				} else {
					extern.set_program_box_status(item.node, file_size, "Done");
				}
				// remove from array
				return false;
			}
			return true;
		});
	})
}

window.addEventListener("message", UnPlug2Extern.receive_signal_callback(), false);
window.setInterval((function () { UnPlug2Extern.poll() }), 3000);


