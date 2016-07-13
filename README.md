## STIX 2.0 Viz

Visualizes STIX 2.0 content using d3. It's 100% browser-based, meaning that you can use it without sending all your data to the server (great!)

### How does it work?

It makes a lot of assumptions is how! It assumes:

- The source - a file you upload, text you paste, or an external server - provides valid JSON
- That JSON has a bunch of keys and values, some of which are arrays
- Everything inside those arrays is a TLO, with an ID, type, and ideally title
- One of those arrays contains a list of relationships between the other TLOs provided

This should match most STIX 2.0 content inside a package. For a slightly out-of-date example, look at `test.json`.

### Neat, a graph! What next?

Click on nodes or paths to get more detailed information for that element (and to pin nodes in place). If you want to unpin a pinned node, double-click it.

If you want to load another JSON file, just click on the title at the top of the page to go back to the input options.

### How can I use it?

Go to [http://yarthepirate.github.io/stix2-viz](http://yarthepirate.github.io/stix2-viz). Upload a JSON file, paste some valid JSON text, or provide the URL for an external JSON file. Hope for the best.
