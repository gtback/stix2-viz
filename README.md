## STIX 2.0 Viz

Visualizes STIX 2.0 content using d3. It's 100% browser-based, meaning that you can use it without sending all your data to the server (great!)

### How does it work?

It makes a lot of assumptions is how! It assumes:

- You upload JSON
- That JSON has a bunch of keys and values, some of which are arrays
- Everything inside those arrays is a TLO, with an ID, type, and ideally title
- References all end in `_ref`

This should match most STIX 2.0 content inside a package. For an example, look at `test.json`.

### How can I use it?

Go to [http://johnwunder.github.io/stix2-viz](http://johnwunder.github.io/stix2-viz). Upload a JSON file. Hope for the best.
