
var add_program_box = (function (download_method, filename) {
	var template = document.getElementById("program-template");
	var container = document.getElementById("program-container");
	var dupe = template.cloneNode(true);
	var labels = dupe.getElementsByTagName("label");
	dupe.setAttribute("collapsed", false);
	labels[0].setAttribute("value", filename);
	labels[1].setAttribute("value", UnPlug2.str("dmethod." + download_method));
	container.appendChild(dupe);
	set_status(dupe, "0.0 MiB", "Loading");
});

var set_status = (function (doc, file_size, process_size) {
	var labels = doc.getElementsByTagName("label");
	labels[2].setAttribute("value", file_size);
	labels[3].setAttribute("value", process_size);
});

// test
window.addEventListener("load", (function () {
try{
	add_program_box("rtmpdump", "some-file-name.flv");
} catch(e) {
	alert(e)
}}), false);


// get requests from unplug window
var receive_signal = (function (event) {
	alert(6)
	alert(event.origin);
	if (event.origin.indexOf("chrome:") != 0) {
		return;
	}
	var msg = window.JSON.parse(event.data);
	alert(msg.toSource());
});
window.addEventListener("message", receive_signal, false);


