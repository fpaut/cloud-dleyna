
	//
	// Global variables
	//
	
	// HTML DOM elements
	var mainView, mediaRenderersListBox, mediaSourcesListBox, searchButton, searchField,
		playButton, pauseButton, stopButton, volButton, volField,
		sortByPopList, sortDirectionPopList, folderPath, folderInfo, outLog;
	
	// DLNA global objects
	// Current media source
	var mediaSource;
	// Remote renderer (null if rendering locally)
	var remoteRenderer;
	// Browsing path from current DMS root folder
	var containerStack; 
	// Sort mode
	var sortMode;
	// Selected item
	var selectedItem;



	//
	// Initialization on HTML page load
	//
	
	function initPage() {
		// init HTML DOM elements
		mainView = document.getElementById("mainView");
		mediaRenderersListBox = document.getElementById("mediaRenderersListBox");
		mediaSourcesListBox = document.getElementById("mediaSourcesListBox");
		searchButton = document.getElementById("searchButton");
		searchField = document.getElementById("searchField");
		playButton = document.getElementById("playButton");
		pauseButton = document.getElementById("pauseButton");
		stopButton = document.getElementById("stopButton");
		volButton = document.getElementById("volButton");
		volField = document.getElementById("volField");
		sortByPopList = document.getElementById("sortByPopList");
		sortDirectionPopList = document.getElementById("sortDirectionPopList");
		folderPath = document.getElementById("folderPath");
		folderInfo = document.getElementById("folderInfo");
		// prevent page scrolling
		mainView.style.height = Math.floor(0.8 * window.innerHeight) + "px";
		// init browsing context
		setSortMode();
		// init DLNA global objects
		containerStack = [];
		// find DMS on the local network
		mediaserver.setServerListener({onserverfound:addMediaSource, onserverlost:removeMediaSourceById});
		// find DMR on the local network
		mediarenderer.setRendererListener({onrendererfound:addMediaRenderer, onrendererlost:removeMediaRendererById});
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
	
	function containerBrowsingListItem(source, container) {
		var node = containerBrowsingElement(source, container);
		node.className="listContent";
		return node;
	}

	
	function mediaItemElement(item) {
		var node = document.createElement("div");
		node.className="content listContent";
		node.innerHTML = item.title;
		return node;
	}
	
	
	//
	// Media renderers management
	//

    function getMediaRendererById(id) {
		for (var i=0; i<mediaRenderersListBox.options.length; i++) {
			if (mediaRenderersListBox.options[i].value == id)
				return mediaRenderersListBox.options[i].mediaRenderer;
		}
    }

	function addMediaRenderer(renderer) {
		// Catch bogus media renderer / detected but introspection failed
		if (renderer.friendlyName == undefined)
			return;
		// check if the media renderer is already known
		if (getMediaRendererById(renderer.id))
			return;
		// add an option to the listbox
		var node = document.createElement("option");
		node.text = renderer.friendlyName;
		node.value = renderer.id;
		node.mediaRenderer = renderer;
		mediaRenderersListBox.add(node);
		if (mediaRenderersListBox.options.length == 1) {
			mediaRenderersListBox.selectedIndex = 0;
			mediaRenderersListBoxChanged();
		}
	}
	
	function removeMediaRendererById(rendererId) {
		// seek media renderer in the listbox
		for (var i=0; i<mediaRenderersListBox.options.length; i++) {
			if (mediaRenderersListBox.options[i].value == rendererId) {
				// remove media renderer from the listbox
				mediaRenderersListBox.remove(i);
				return;
			}
		}
	}

	function setRemoteRenderer(renderer) {
		if (remoteRenderer)
			remoteRenderer.controller.stop();
		remoteRenderer = renderer;
		if (remoteRenderer) {
			volField.value = remoteRenderer.controller.volume;
			mediaserver.setProtocolInfo(remoteRenderer.protocolInfo);
		}
		clearFolderInfo();
		if (containerStack.length > 0)
			browseContainerInStack(mediaSource, containerStack[containerStack.length-1].id)
	}
	
	function mediaRenderersListBoxChanged() {
		if (mediaRenderersListBox.selectedIndex!=-1)
			setRemoteRenderer(mediaRenderersListBox.options[mediaRenderersListBox.selectedIndex].mediaRenderer);
	}
	
	//
	// Media sources management
	//

    function getMediaSourceById(id) {
		for (var i=0; i<mediaSourcesListBox.options.length; i++) {
			if (mediaSourcesListBox.options[i].value == id)
				return mediaSourcesListBox.options[i].mediaSource;
		}
    }

	function addMediaSource(source) {
		// Catch bogus media source / detected but introspection failed
		if (source.friendlyName == undefined)
			return;
		// check if the media source is already known
		if (getMediaSourceById(source.id))
			return;
		// add an option to the listbox
		var node = document.createElement("option");
		node.text = source.friendlyName;
		node.value = source.id;
		node.mediaSource = source;
		mediaSourcesListBox.add(node);
		if (mediaSourcesListBox.options.length == 1) {
			mediaSourcesListBox.selectedIndex = 0;
			logMediaSourceInfo(source);
		}
	}
	
	function removeMediaSourceById(sourceId) {
		// seek media source in the listbox
		for (var i=0; i<mediaSourcesListBox.options.length; i++) {
			if (mediaSourcesListBox.options[i].value == sourceId) {
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
		clearFolderBrowsing();
		if (source.root)
			browseMediaSourceContainer(source, source.root);
		mediaSource = source;
	}

	
	function containerContentsItemOnClick() {
		if (this.mediaContainer) {
			browseMediaSourceContainer(this.mediaSource, this.mediaContainer);
			return;
		}
		this.className = "content selectedContent listContent";
		if (selectedItem)
			selectedItem.className = "content listContent";
		selectedItem = this;
		if (remoteRenderer) {
			var renderer = remoteRenderer;
			remoteRenderer.openURI(this.mediaItem.content.uri,
					function(){renderer.controller.play();},
					debugLog);
		}
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
	// Media source find under given container
	//

    
	function findInMediaSourceContainer(source, container, nameQuery) {
		var findCount = 10;
		var findOffset = 0;
		
		function findErrorCB(str) {
			alert("Error searching for " + nameQuery + " in " + container.title + " : " + str);
		}
		
	    function findContainerCB(mediaObjectArray) 
	    {
			// exit if we started browsing another container
			if (container.id != containerStack[containerStack.length-1].id
				// or if we launched another search
					|| container.id != searchButton.container.id
					|| source.id != searchButton.source.id
					|| nameQuery != searchField.value)
				return;
			for (var i=0; i<mediaObjectArray.length; i++) {
				var node = null;
				if (mediaObjectArray[i].type == "container") {
					node = containerBrowsingListItem(source, mediaObjectArray[i]);
				}
				else {
					node = mediaItemElement(mediaObjectArray[i]);
				}
				node.mediaItem = mediaObjectArray[i];
				node.onclick = containerContentsItemOnClick;
				outLog.appendChild(node);
			}
			if (mediaObjectArray.length == findCount) {
				findOffset += findCount;
				source.find(container.id, 
						findContainerCB, 
						findErrorCB,  /* errorCallback */
						"DisplayName contains \"" + (nameQuery ? nameQuery : "*") + "\"", /* search query */
						sortMode,  /* sortMode */
						findCount, 
						findOffset);
			}
	    }
		
		clearFolderInfo();
		source.find(container.id, 
				findContainerCB, 
				findErrorCB, /* errorCallback */
				"DisplayName contains \"" + (nameQuery ? nameQuery : "*") + "\"", /* search query */
				sortMode, /* sortMode */
				findCount, 
				findOffset);
	}


	//
	// Media source browsing by folder management
	//

    
	function browseMediaSourceContainer(source, container) {
		var browseCount = 10;
		var browseOffset = 0;
		
		function browseErrorCB(str) {
			alert("Error browsing " + container.title + " : " + str);
		}
		
	    function browseContainerCB(mediaObjectArray) 
	    {
			// exit if we are not browsing the current container
			if (container.id != containerStack[containerStack.length-1].id)
				return;
			for (var i=0; i<mediaObjectArray.length; i++) {
				var node = null;
				if (mediaObjectArray[i].type == "container") {
					node = containerBrowsingListItem(source, mediaObjectArray[i]);
				}
				else {
					node = mediaItemElement(mediaObjectArray[i]);
				}
				node.mediaItem = mediaObjectArray[i];
				node.onclick = containerContentsItemOnClick;
				outLog.appendChild(node);
			}
			if (mediaObjectArray.length == browseCount) {
				browseOffset += browseCount;
				source.browse(container.id, 
						browseContainerCB, 
						browseErrorCB,  /* errorCallback */
						sortMode,  /* sortMode */
						browseCount, 
						browseOffset);
			}
	    }
		
		searchButton.source = source;
		searchButton.container = container;
		containerStack.push(container);
		pushContainerToFolderPath(source, container);
		clearFolderInfo();
		source.browse(container.id, 
				browseContainerCB, 
				browseErrorCB, /* errorCallback */
				sortMode, /* sortMode */
				browseCount, 
				browseOffset);
	}


	//
	// Content browsing sort mode
	//

	function setSortMode() {
		sortMode = {
				attributeName: sortByPopList.options[sortByPopList.selectedIndex].value,
				order: sortDirectionPopList.options[sortDirectionPopList.selectedIndex].value
		};
	}


	//
	// Clear content browsing areas
	//

	function clearFolderInfo() {
		outLog = document.createElement("div");
		outLog.style.width = (folderInfo.clientWidth - 4) + "px";
		outLog.style.maxWidth = folderInfo.clientWidth + "px";
		outLog.style.maxHeight = folderInfo.clientHeight + "px";
		outLog.style.overflow = "auto";
		folderInfo.innerHTML="<hr>";
		folderInfo.appendChild(outLog);
	}

	    
	function clearFolderBrowsing() {
		containerStack = [];
		folderPath.innerHTML="<hr>";
		clearFolderInfo();
	}
	
	function clearMediaSourceBrowsing() {
		clearFolderBrowsing();
	}
	
	//
	// Debug log function
	//

	function debugLog(msg) {
		alert(msg);
	}
	
	//
	// Cloudeebus manifest
	//

	var manifest = {
			name: "cloud-dLeyna",
			version: "development",
			key: "dLeyna",
			permissions: [
				"com.intel.dleyna-server",
				"com.intel.dleyna-renderer"
			]
	};
	
	//
	// Main Init function
	//

	function initRenderers() {
		mediarenderer.reset();
		mediarenderer.bus = mediaserver.bus;
		mediarenderer.uri = mediaserver.uri;
		mediarenderer.manager = mediarenderer.bus.getObject(
				mediarenderer.busName, 
				"/com/intel/dLeynaRenderer", 
				initPage);
	}
	
	var init = function () {
		var cloudeebusHost = "localhost";
		var cloudeebusPort = "9000";
		var queryString = window.location.toString().split("\?")[1];
		if (queryString) {
			var getVars = queryString.split("\&");
			for (var i=0; i<getVars.length; i++) {
				var varVal = getVars[i].split("\=");
				if (varVal.length == 2) {
					if (varVal[0] == "host")
						cloudeebusHost = varVal[1];
					else if (varVal[0] == "port")
						cloudeebusPort = varVal[1];
				}
			}
		}
		var cloudeebusURI = "ws://" + cloudeebusHost + ":" + cloudeebusPort;
		mediaserver.init(cloudeebusURI, 
				manifest,
				initRenderers,
				debugLog);
	};
	
	// window.onload can work without <body onload="">
	window.onload = init;