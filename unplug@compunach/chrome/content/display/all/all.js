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

/*

TODO Add a save button
TODO Add a way to select the folder to download into
TODO Some download methods are not compatible with download all (eg: copy link). Need to skip them (perhaps change avail_buttons).
TODO CSS needed on "Plus N which won't be downloaded"
TODO l11n / translations.


*/

// results from pop.js (or callee)
var results = window.arguments[0];

// methods which were unticked
var excluded_methods = [];


var download_solution = (function () {
	var solution = {
		"results_by_method" : {},
		"method_names" : []
	};

	for (var i = 0; i < results.length; ++i) {
		var methods = UnPlug2DownloadMethods.avail_buttons(results[i]);
		var best_method = null;
		for (var j = 0; j < methods.length; ++j) {
			if (excluded_methods.indexOf(methods[j]) < 0) {
				best_method = methods[j];
				break;
			}
		}
		if (solution["method_names"].indexOf(best_method) < 0) {
			solution["method_names"].push(best_method);
			solution["results_by_method"][best_method] = [];
		}
		solution["results_by_method"][best_method].push(results[i])
	}

	solution["method_names"].sort((function (a, b) {
		if (a === null) {
			return +1;
		} else if (b === null) {
			return -1;
		} else {
			return solution["results_by_method"][b].length - solution["results_by_method"][a].length;
		}
	}));

	return solution;
});

var refresh_list = (function () {
	var container = document.getElementById("download-method-list");
	var solution = download_solution();

	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}

	var new_checkbox = (function (method, count) {
		var elem = document.createElement("checkbox");
		var label = UnPlug2.str("dmethod." + name);
		if (count) {
			label += " (" + count + " files)";
			checked = true;
		} else {
			checked = false;
		}
		elem.setAttribute("label", label);
		elem.setAttribute("accesskey", UnPlug2.str("dmethod." + name + ".a"));
		elem.setAttribute("tooltiptext", UnPlug2.str("dmethod." + name + ".tip"));
		elem.setAttribute("checked", checked);
		container.appendChild(elem);
		return elem;
	});
	
	for (var i = 0; i < solution["method_names"].length; ++i) {
		var name = solution["method_names"][i];
		var count = solution["results_by_method"][name].length;
		if (name === null) {
			var elem = document.createElement("label");
			elem.setAttribute("value", "Plus " + count + " results which will not be downloaded");
			container.appendChild(elem);
		} else {
			new_checkbox(name, count).addEventListener("command", (function (name) {
				return (function (evt) {
					if (excluded_methods.indexOf(name) < 0) {
						excluded_methods.push(name);
					}
					refresh_list();
				});
			})(name), false);
		}
	}

	for (var i = 0; i < excluded_methods.length; ++i) {
		var name = excluded_methods[i];
		new_checkbox(name, null).addEventListener("command", (function (name) {
			return (function (evt) {
				var idx = excluded_methods.indexOf(name);
				if (idx >= 0) {
					excluded_methods.splice(idx, 1);
				}
				refresh_list();
			});
		})(name), false);
	}
});

var begin_download = (function () {
	// TODO
	// XXX for each method in solution
	var method = document.getElementById("save_all_list").value;
	UnPlug2DownloadMethods.exec_multiple(method, results);
});

window.addEventListener("load", (function () {
	refresh_list();
}), false);

