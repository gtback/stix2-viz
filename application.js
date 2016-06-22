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
var force = d3.layout.force().charge(-120).linkDistance(d3Config.linkMultiplier * d3Config.nodeSize).size([width, height]);
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
  var output = [];
  for (var i = 0, f; f = files[i]; i++) {
    document.getElementById('chosen-files').innerText += f.name + " ";
    hideMessages();

    var r = new FileReader();
    r.onload = function(e) {addToGraph(JSON.parse(e.target.result))};
    r.readAsText(f);
  }
}

function addToGraph(package) {
  buildNodes(package);
  initGraph();
}

function initGraph() {
  force.nodes(currentGraph.nodes).links(currentGraph.edges).start();
  labelForce.nodes(labelGraph.nodes).links(labelGraph.edges).start();

  
  // Adds style directly because it wasn't getting picked up by the style sheet
  var link = svg.selectAll('line.link').data(currentGraph.edges).enter().append('line')
      .attr('class', 'link')
      .style("stroke", "#aaa")
      .style("stroke-width", "1px");

  link.append('title').text(function(d) {return d.label;})

  var node = svg.selectAll("circle.node")
      .data(currentGraph.nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", d3Config.nodeSize)
      .style("fill", function(d) { return d3Config.color(d.typeGroup); })
      .call(force.drag);
  node.on('click', function(d, i) {selectedContainer.innerText = JSON.stringify(d, null, 2); }) // If they're holding shift, release

  // Fix on click/drag, unfix on double click
  force.drag().on('dragstart', function(d, i) { d.fixed = true });

  // Right click will greatly dim the node and associated edges
  node.on('contextmenu', function(d) {
    if(d.dimmed) {
      d.dimmed = false;
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

function buildNodes(package) {
  var tempEdges = [];
  // Iterate through each key on the package. If it's an array, assume every item is a TLO.
  Object.keys(package).forEach(function(key) {
    if(package[key].constructor === Array) {
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
  });

  // Now, go back through the edges and fix the "to" to point to the actual index, then add it to the official edges list
  for(var i = 0; i < tempEdges.length; i++) {
    var tempEdge = tempEdges[i];
    if(idCache[tempEdge.to] === null || idCache[tempEdge.to] === undefined) {
      console.error("Couldn't find target!", tempEdge);
    } else {
      currentGraph.edges.push({source: tempEdge.from, target: idCache[tempEdge.to], label: tempEdge.label});
    }
  }

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

function titleFor(tlo) {
  if(tlo.type === 'relationship') {
    return "rel: " + (tlo.kind_of_relationship);
  } else if (tlo.title !== undefined) {
    return tlo.title;
  } else {
    return tlo.type;
  }
}

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
    Object.keys(tlo).forEach(function(key) {
      if(refRegex.exec(key)) {
        // Add a temporary edge pointing to the ID...this is because some references will refer to things we haven't added yet, and therefore for which we won't know the index
        tempEdges.push({from: idCache[tlo.id], to: tlo[key], label: key})
      }
    });
  }
}

function hideMessages() {
  uploader.style.display = "none";
  canvasContainer.style.display = "block";
}

// Bind our events!
document.getElementById('files').addEventListener('change', handleFileSelect, false);
uploader.addEventListener('dragover', handleDragOver, false);
uploader.addEventListener('drop', handleFileDrop, false);
