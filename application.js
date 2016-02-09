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
width = parseInt(styles.width) - 350;
height = parseInt(styles.height);

canvas.style.width = width;
canvas.style.height = height;

refRegex = /_ref$/;
var force = d3.layout.force().charge(-120).linkDistance(d3Config.linkMultiplier * d3Config.nodeSize).size([width, height]);
var svg = d3.select('svg');
var typeGroups = {};
var typeIndex = 0;

var currentGraph = {
  nodes: [],
  edges: []
}

var idCache = {};

console.log(d3Config);

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

  var link = svg.selectAll('.link').data(currentGraph.edges).enter().append('line').attr('class', 'link');

  var node = svg.selectAll(".node")
      .data(currentGraph.nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", d3Config.nodeSize)
      .style("fill", function(d) { return d3Config.color(d.typeGroup); })
      .call(force.drag);

  node.append('title').text(function(d) {return d.title || d.type});
  node.on('click', function(d, i) {selectedContainer.innerText = JSON.stringify(d, null, 2)})

  force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
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
