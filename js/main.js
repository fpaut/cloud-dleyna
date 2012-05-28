
	//
	// Global variables
	//
	
	// HTML DOM elements
	var mediaSourcesListBox, mediaSourceInfo, sortByPopList, sortDirectionPopList, folderPath, folderInfo, mediaContent, outLog;
	
	// DLNA global objects
	// Browsing path from current DMS root folder
	var containerStack; 
	// Sort mode
	var sortMode;
	
	//
	// Initialization on HTML page load
	//
	
	function initPage() {
		// init HTML DOM elements
		mediaSourcesListBox = document.getElementById("mediaSourcesListBox");
		mediaSourceInfo = document.getElementById("mediaSourceInfo");
		sortByPopList = document.getElementById("sortByPopList");
		sortDirectionPopList = document.getElementById("sortDirectionPopList");
		folderPath = document.getElementById("folderPath");
		folderInfo = document.getElementById("folderInfo");
		mediaContent = document.getElementById("mediaContent");
		// init browsing context
		setSortMode();
		// init DLNA global objects
		mediaSources = new Array();
		containerStack = new Array();
		// find DMS on the local network
		tizen.mediacontent2.getLocalNetworkMediaSources({onserverfound:addMediaSource, onserverlost:removeMediaSource});
	}

	
	//
	// Dynamic HTML DOM elements creation
	//
	
	function containerBrowsingElement(source, container) {
		var node = document.createElement("input");
		node.type = "button";
		node.value = container.title;
		node.mediaSource = source;
		node.mediaContainer = container;
		return node;
	}
	
	function mediaItemElement(item) {
		var node = document.createElement("div");
		node.style.borderStyle = "solid";
		node.style.borderWidth = "1px";
		node.style.backgroundColor = "#F7E9E9";
		node.innerHTML = item.title;
		return node;
	}
	
	
	//
	// Media sources management
	//

    function getMediaSourceById(deviceId) {
		for (var i=0; i<mediaSourcesListBox.options.length; i++) {
			if (mediaSourcesListBox.options[i].value == deviceId)
    			return mediaSourcesListBox.options[i].mediaSource;
    	}
    }

	function addMediaSource(source) {
		// check if the media source is already known
		if (getMediaSourceById(source.deviceId))
			return;
		// add an option to the listbox
		var node = document.createElement("option");
		node.text = source.friendlyName;
		node.value = source.deviceId;
		node.mediaSource = source;
		mediaSourcesListBox.add(node);
	}
	
	function removeMediaSource(source) {
		// seek media source in the listbox
		for (var i=0; i<mediaSourcesListBox.options.length; i++) {
			if (mediaSourcesListBox.options[i].value == source.deviceId) {
				// clear browsing area if the current media source is removed
				if (i == mediaSourcesListBox.selectedIndex)
					clearMediaSourceBrowsing();
				// remove media source from the listbox
				mediaSourcesListBox.remove(i);
				return;
			}
		}
	}

	
	//
	// Selected media source info
	//

	function logMediaSourceInfo(source) {
		mediaSourceInfo.innerHTML = "<b>" + source.friendlyName + "<b><br>";
		mediaSourceInfo.innerHTML += source.deviceId + "<br>";
		if (source.serialNumber)
			mediaSourceInfo.innerHTML += "s/n: " + source.serialNumber + "<br>";
		if (source.manufacturerURL)
			mediaSourceInfo.innerHTML += "Manufacturer: " + "<a href='" + source.manufacturerURL + "'>" + source.manufacturerURL + "</a><br>";
		if (source.modelName)
			mediaSourceInfo.innerHTML += "Model: " + source.modelName + " (" + source.modelNumber + ")<br>"; 
		if (source.modelURL)
			mediaSourceInfo.innerHTML += "<a href='" + source.modelURL + "'>" + source.modelURL + "</a><br>";
		if (source.modelDescription)
			mediaSourceInfo.innerHTML += "Description: " + source.modelDescription + "<br>";
		if (source.UPC)
			mediaSourceInfo.innerHTML += "UPC: " + source.UPC + "<br>";
		if (source.presentationURL)
			mediaSourceInfo.innerHTML += "<a href='" + source.presentationURL + "'>" + source.presentationURL + "</a><br>";
		clearFolderBrowsing();
		if (source.rootContainer)
			browseMediaSourceContainer(source, source.rootContainer);
	}

	
	//
	// Media content view
	//

	function fitItemNodeInClientView(item, node, view) {
		// align largest item dimension on view, keep proportions 
		var ratio;
		if (item.width > item.height)
			ratio = view.clientWidth / item.width;
		else
			ratio = view.clientHeight / item.height;
		node.width = item.width * ratio;
		node.height = item.height * ratio;
		return node;
	}
	
	function containerContentsItemOnClick() {
		clearContentArea();
		if (this.mediaContainer) {
			browseMediaSourceContainer(this.mediaSource, this.mediaContainer);
			return;
		}
		var node = null;
		if (this.mediaItem.type == "IMAGE") {
			node = document.createElement("img");
			node.src = this.mediaItem.itemURI;
			fitItemNodeInClientView(this.mediaItem, node, mediaContent);
		}
		else {
			if (this.mediaItem.type == "VIDEO") {
				node = document.createElement("video");
				fitItemNodeInClientView(this.mediaItem, node, mediaContent);
			}
			else if (this.mediaItem.type == "AUDIO") {
				node = document.createElement("audio");
			}
			else 
				return;
			var source = document.createElement("source");
			source.src = this.mediaItem.itemURI;
// ####		source.type = this.mediaItem.mimeType; // let browser guess 
			node.controls = true;
			node.autoplay = true;
			node.appendChild(source);
		}
		node.style.borderStyle = "solid";
		node.style.borderWidth = "1px";
		mediaContent.appendChild(node);
	}
	
	
	//
	// Current browsing path management
	//

	function folderPathButtonOnClick() {
		browseContainerInStack(this.mediaSource, this.mediaContainer.id);
	}
	
	function pushContainerToFolderPath(source, container) {
		var node = containerBrowsingElement(source, container);
		node.onclick = folderPathButtonOnClick;
		folderPath.appendChild(node);		
	}
	
	function browseContainerInStack(source, containerId) {
		var i;
		var container = null;
		// clear all containers below the selected one
    	for (i=0; i<containerStack.length; i++) {
    		if (containerStack[i].id == containerId) {
    			container = containerStack[i];
    			containerStack.splice(i,containerStack.length-i);
    		}
    	}
    	if (!container)
    		return;
		folderPath.innerHTML="<hr>";
    	for (i=0; i<containerStack.length; i++) {
    		pushContainerToFolderPath(source, containerStack[i]);
    	}
    	browseMediaSourceContainer(source, container);
	}
	
	
	//
	// Media source browsing by folder management
	//

	var browseCount = 10;
    
	function browseMediaSourceContainer(source, container) {
		containerStack.push(container);
		pushContainerToFolderPath(source, container);
		clearFolderInfo();
		source.browseContainer(container.id, { /* MediaObjectArraySuccessCallback */
						onsuccess: browseContainerCB, 
						browseCount: browseCount, 
						browseOffset: 0,
						mediaSource: source,
						container: container,
						sortMode: sortMode
						}, 
				null, /* errorCallback */
				sortMode, /* sortMode */
				browseCount, 
				0);
	}

    function browseContainerCB(mediaObjectArray) 
    {
    	// exit if we are not browsing the current container
    	if (this.container.id != containerStack[containerStack.length-1].id)
    		return;
     	for (var i=0; i<mediaObjectArray.length; i++) {
    		var node = null;
    		if (mediaObjectArray[i].type == "FOLDER" || mediaObjectArray[i].type == "CONTAINER") {
    			node = containerBrowsingElement(this.mediaSource, mediaObjectArray[i]);
    		}
    		else {
    			node = mediaItemElement(mediaObjectArray[i]);
    		}
    		node.mediaItem = mediaObjectArray[i];
    		node.onclick = containerContentsItemOnClick;
    		node.style.width = "100%";
    		outLog.appendChild(node);
    		outLog.appendChild(document.createElement("br"));
    	}
       	if (mediaObjectArray.length == this.browseCount) {
       		this.browseOffset += this.browseCount;
       		this.mediaSource.browseContainer(this.container.id, this, null, this.sortMode, this.browseCount, this.browseOffset);
       	}
    }

	//
	// Content browsing sort mode
	//

	function setSortMode() {
		var attribute = sortByPopList.options[sortByPopList.selectedIndex].value;
		var direction = sortDirectionPopList.options[sortDirectionPopList.selectedIndex].value;
		sortMode = new tizen.SortMode(attribute, direction);
	}


	//
	// Clear content browsing areas
	//

	function clearContentArea() {
		mediaContent.innerHTML="";
	}
	    
	function clearFolderInfo() {
		folderInfo.innerHTML="<hr>";
    	outLog = document.createElement("div");
    	outLog.style.width = folderInfo.clientWidth + "px";
    	outLog.style.height = folderInfo.clientHeight + "px";
    	outLog.style.overflow = "auto";
       	folderInfo.appendChild(outLog);
		clearContentArea();
	}

//Initialize function
var init = function () {
	initPage();
};
// window.onload can work without <body onload="">
window.onload = init;

