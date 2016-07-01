// Copyright (c) 2016, The MITRE Corporation. All rights reserved.
// See LICENSE.txt for complete terms.


// Config
var d3Config = {
  color: d3.scale.category20(),
  nodeSize: 10,
  linkMultiplier: 20
}

// Init some stuff
selectedContainer = document.getElementById('selection');
uploader = document.getElementById('uploader');
canvasContainer = document.getElementById('canvas-container');
canvas = document.getElementById('canvas');
styles = window.getComputedStyle(uploader);
width = 900;// parseInt(styles.width) - 350;
height = 450;// parseInt(styles.height);
canvas.style.width = width;
canvas.style.height = height;

refRegex = /_ref$/;
relationshipsKeyRegex = /(r|R)elationships/; // Added by Matt
// Determines the "float and repel" behavior of the nodes
var force = d3.layout.force().charge(-400).linkDistance(d3Config.linkMultiplier * d3Config.nodeSize).size([width, height]);
// Determines the "float and repel" behavior of the text labels
var labelForce = d3.layout.force().gravity(0).linkDistance(25).linkStrength(8).charge(-120).size([width, height]);
var svg = d3.select('svg');
var typeGroups = {};
var typeIndex = 0;

var currentGraph = {
  nodes: [],
  edges: []
}
var labelGraph = {
  nodes: [],
  edges: []
}

var idCache = {};

/* ******************************************************
 * This group of functions is for handling file "upload."
 * They take an event as input and parse the file on the
 * front end.
 * ******************************************************/
function handleFileSelect(evt) {
  handleFiles(evt.target.files);
}
function handleFileDrop(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  handleFiles(evt.dataTransfer.files);
}
function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}
function handleFiles(files) {
  // files is a FileList of File objects (in our case, just one)
  for (var i = 0, f; f = files[i]; i++) {
    document.getElementById('chosen-files').innerText += f.name + " ";
    hideMessages();

    var r = new FileReader();
    r.onload = function(e) {addToGraph(JSON.parse(e.target.result))};
    r.readAsText(f);
  }
}
/* ---------------------------------------------------- */

/* ******************************************************
 * Handles content pasted to the text area.
 * ******************************************************/
function handleTextarea() {
  content = document.getElementById('paste-area').value;
  handlePackage(content);
}

/* ******************************************************
 * Fetches STIX 2.0 data from an external URL (supplied
 * user) via AJAX. Server-side Access-Control-Allow-Origin
 * must allow cross-domain requests for this to work.
 * ******************************************************/
function handleFetchJson() {
  var url = document.getElementById("url").value;
  fetchJsonAjax(url, handlePackage);
}

/* ******************************************************
 * Attempts to build and display the graph from an
 * arbitrary input string. If parsing the string does not
 * produce valid JSON, fails gracefully and alerts the user.
 * 
 * Takes a string as input.
 * ******************************************************/
function handlePackage(package) {
  try {
    var parsed = JSON.parse(package); // Saving this to a variable stops the rest of the function from executing on parse failure
    hideMessages();
    addToGraph(parsed);
  } catch (err) {
    alert("Something went wrong!\n\nError:\n" + err);
  }
}

function addToGraph(package) {
  buildNodes(package);
  initGraph();
}

/* ******************************************************
 * Generates the components on the chart from the JSON data
 * ******************************************************/
function initGraph() {
  force.nodes(currentGraph.nodes).links(currentGraph.edges).start();
  labelForce.nodes(labelGraph.nodes).links(labelGraph.edges).start();

  // Adds style directly because it wasn't getting picked up by the style sheet
  var link = svg.selectAll('line.link').data(currentGraph.edges).enter().append('line')
      .attr('class', 'link')
      .style("stroke", "#aaa")
      .style("stroke-width", "3px");
  // Add the text labels to the links
  link.append('title').text(function(d) {return d.label;})
  link.on('click', function(d, i) { selectedContainer.innerText = JSON.stringify(d, replacer, 2); });

  var node = svg.selectAll("circle.node")
      .data(currentGraph.nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", d3Config.nodeSize)
      .style("fill", function(d) { return d3Config.color(d.typeGroup); })
      .call(force.drag); // <-- What does the "call()" function do?
  node.on('click', function(d, i) {selectedContainer.innerText = JSON.stringify(d, replacer, 2); }) // If they're holding shift, release

  // Fix on click/drag, unfix on double click
  // Ideally, we could break this out into a function that
  // just returns !(d.fixed), but for some reason the callback
  // function of force.drag().on() thinks d.fixed is a number
  // even when it has been previously set as a boolean.
  // I don't know, man. Javascript.
  force.drag().on('dragstart', function(d, i) { d.fixed = true });
  node.on('dblclick', function(d, i) { d.fixed = false });

  // Right click will greatly dim the node and associated edges
  // >>>>>>> Does not currently work <<<<<<<
  node.on('contextmenu', function(d) {
    if(d.dimmed) {
      d.dimmed = false; // <-- What is this? Where is this set? How does this work?
      d.attr("class", "node");
    } else {
      d.dimmed = true;
      d.attr("class", "node dimmed");
    }
  })

  var anchorNode = svg.selectAll("g.anchorNode").data(labelForce.nodes()).enter().append("svg:g").attr("class", "anchorNode");
  anchorNode.append("svg:circle").attr("r", 0).style("fill", "#FFF");
		anchorNode.append("svg:text").text(function(d, i) {
		return i % 2 == 0 ? "" : titleFor(d.node);
	}).style("fill", "#555").style("font-family", "Arial").style("font-size", 12);

  force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });

    anchorNode.each(function(d, i) {
      labelForce.start();
			if(i % 2 == 0) {
				d.x = d.node.x;
				d.y = d.node.y;
			} else {
				var b = this.childNodes[1].getBBox();

				var diffX = d.x - d.node.x;
				var diffY = d.y - d.node.y;

				var dist = Math.sqrt(diffX * diffX + diffY * diffY);

				var shiftX = b.width * (diffX - dist) / (dist * 2);
				shiftX = Math.max(-b.width, Math.min(0, shiftX));
				var shiftY = 5;
				this.childNodes[1].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
			}
		});

    anchorNode.call(function() {
			this.attr("transform", function(d) {
				return "translate(" + d.x + "," + d.y + ")";
			});
		});
  });
}

/* ******************************************************
 * Parses the JSON input and builds the arrays used by
 * initGraph().
 * 
 * Takes a JSON object as input.
 * ******************************************************/
function buildNodes(package) {
  var tempEdges = [];
  var relationships = [];
  // Iterate through each key on the package. If it's an array, assume every item is a TLO.
  Object.keys(package).forEach(function(key) {
    if(package[key].constructor === Array) {
      /////////////////////////////////////////////////////
      ////////////    CONSTRUCTION ZONE    ////////////////
      if (relationshipsKeyRegex.exec(key)) {
        // do stuff
        relationships = package[key];
        console.log(relationships.length);
      } else {
          // This junk was originally one level up. The nested if did not exist
          var container = package[key];
          for(var i = 0; i < container.length; i++) {
          // So, in theory, each of these should be a TLO. To be sure, we'll check to make sure it has an `id` and `type`. If not, raise an error and ignore it.
          var maybeTlo = container[i];
          if(maybeTlo.id === undefined || maybeTlo.type === undefined) {
            console.error("Should this be a TLO???", maybeTlo)
          } else {
            addTlo(maybeTlo, tempEdges);
          }
        }
      }
    }
  });

  addRelationships(relationships);
  ////////////////////////////////////////////////////

  // Add the legend so we know what's what
  var ul = document.getElementById('legend-content');
  Object.keys(typeGroups).forEach(function(typeName) {
    var li = document.createElement('li');
    var val = document.createElement('p');
    var key = document.createElement('div');
    key.style.backgroundColor = d3Config.color(typeGroups[typeName]);
    val.innerText = typeName;
    li.appendChild(key);
    li.appendChild(val);
    ul.appendChild(li);
  });
}

/* ******************************************************
 * Adds a title to a TLO Node
 * ******************************************************/
function titleFor(tlo) {
  if(tlo.type === 'relationship') {
    return "rel: " + (tlo.value);// (tlo.kind_of_relationship); // <-- This is where the error comes from on relationship nodes
  } else if (tlo.title !== undefined) {
    return tlo.title;
  } else {
    return tlo.type;
  }
}

/* ******************************************************
 * Adds a TLO
 * TODO:
 *   - Document what gets passed in here
 *   - Document what gets affected
 * ******************************************************/
function addTlo(tlo, tempEdges) {
  if(idCache[tlo.id]) {
    console.log("Already added, skipping!", tlo)
  } else {
    if(typeGroups[tlo.type] === undefined) {
      typeGroups[tlo.type] = typeIndex++;
    }
    tlo.typeGroup = typeGroups[tlo.type];

    idCache[tlo.id] = currentGraph.nodes.length; // Edges reference nodes by their array index, so cache the current length. When we add, it will be correct
    currentGraph.nodes.push(tlo);

    labelGraph.nodes.push({node: tlo}); // Two labels will orbit the node, we display the less crowded one and hide the more crowded one.
    labelGraph.nodes.push({node: tlo});

    labelGraph.edges.push({
			source : (labelGraph.nodes.length - 2),
			target : (labelGraph.nodes.length - 1),
      weight: 1
		});

    // Now, look for edges...any property ending in "_ref"
    // MATT: But this creates a separate edge for both the source and target _ref.
    //   shouldn't they ideally just be two endpoints of the same edge?
    //Object.keys(tlo).forEach(function(key) {
    //  if(refRegex.exec(key)) {
        // Add a temporary edge pointing to the ID...this is because some references will refer to things we haven't added yet, and therefore for which we won't know the index
    //    tempEdges.push({from: idCache[tlo.id], to: tlo[key], label: key})
    //  }
    //});
  }
}

/* ******************************************************
 * Adds relationships to the graph based on the array of
 * relationships contained in the data.
 * 
 * Takes an array as input.
 * ******************************************************/
function addRelationships(relationships) {
  for(var i = 0; i < relationships.length; i++) {
    var rel = relationships[i];
    if(idCache[rel.source_ref] === null || idCache[rel.source_ref] === undefined) {
      console.error("Couldn't find source!", rel);
    } else if (idCache[rel.target_ref] === null || idCache[rel.target_ref] === undefined) {
      console.error("Couldn't find target!", rel);
    } else {
      currentGraph.edges.push({source: idCache[rel.source_ref], target: idCache[rel.target_ref], label: rel.value});
    }
  }
}

/* ******************************************************
 * Hides the data entry container and displays the graph
 * container
 * ******************************************************/
function hideMessages() {
  uploader.style.display = "none";
  canvasContainer.style.display = "block";
}

/* ******************************************************
 * Screens out D3 chart data from the presentation.
 * Called as the 2nd parameter to JSON.stringify().
 * ******************************************************/
function replacer(key, value) {
  var blacklist = ["typeGroup", "index", "weight", "x", "y", "px", "py", "fixed"];
  if (blacklist.indexOf(key) >= 0) {
    return undefined;
  }
  return value;
}

/* ******************************************************
 * Generic AJAX 'GET' request.
 * 
 * Takes a URL and a callback function as input.
 * ******************************************************/
function fetchJsonAjax(url, cfunc) {
  var xhttp;
  if (window.XMLHttpRequest) {
    xhttp = new XMLHttpRequest();
  } else {
    xhttp = new ActiveXObject("Microsoft.XMLHTTP"); // For IE5 and IE6 luddites
  }
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      cfunc(xhttp.responseText);
    }
  }
  xhttp.open("GET", url, true);
  xhttp.send();
}

// Bind our events!
document.getElementById('files').addEventListener('change', handleFileSelect, false);
document.getElementById('paste-parser').addEventListener('click', handleTextarea, false);
document.getElementById('fetch-url').addEventListener('click', handleFetchJson, false);
uploader.addEventListener('dragover', handleDragOver, false);
uploader.addEventListener('drop', handleFileDrop, false);
