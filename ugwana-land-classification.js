// Define time range and ROI
var start_date = '2006-01-01';
var end_date = '2008-12-31';

var roi = vcr.geometry().dissolve();
Map.centerObject(roi, 8);
Map.addLayer(roi, {}, 'Rwanda ROI');

// print('image', image);
// // Load training data and assign class labels
var forest = ee.FeatureCollection('projects/sixth-shield-437405-f4/assets/mangrove_007').map(function(f){ return f.set('class', 1); });
var bareland = ee.FeatureCollection('projects/sixth-shield-437405-f4/assets/bareland_07').map(function(f){ return f.set('class', 2); });
var water = ee.FeatureCollection('projects/sixth-shield-437405-f4/assets/water_07').map(function(f){ return f.set('class', 3); });
//var invasive = ee.FeatureCollection('projects/sixth-shield-437405-f4/assets/invasive_07_12_17').map(function(f){ return f.set('class', 4); });

var gdp_data = forest.merge(bareland).merge(water);

//Sentinel-2 data and indices
var sent_2 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
  .filterDate(start_date, end_date)
  .filterBounds(roi)
  .filter(ee.Filter.lt('CLOUD_COVER', 30))
  .select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7'])
  .median()
  .clip(roi);

var addNdti = function(img) {
  var ndti = img.normalizedDifference(['SR_B3', 'SR_B2'])
               .rename('NDTI');
  return img.addBands([ndti]);
};

// Center the map on your ROI
Map.centerObject(roi, 10);

var visParams = {
  bands: ['SR_B3', 'SR_B2', 'SR_B1'],
  min: 7000,  // Close to your min values
  max: 20000, // Adjusted for better contrast (lower than max to avoid washed-out look)
  gamma: 1.2
};

// Add the layer
Map.addLayer(sent_2, visParams, 'L7 True Color');

var ndvi = sent_2.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI');
var ndmi = sent_2.normalizedDifference(['SR_B4', 'SR_B5']).rename('NDMI');
var mndwi = sent_2.normalizedDifference(['SR_B2', 'SR_B5']).rename('MNDWI');
var ndbi = sent_2.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDBI');
var bsi = sent_2.expression(
  '((SR_B5 + SR_B3) - (SR_B4 + SR_B1)) / ((SR_B5 + SR_B3) + (SR_B4 + SR_B1))', {
    'SR_B1': sent_2.select('SR_B1'),
    'SR_B3': sent_2.select('SR_B3'),
    'SR_B4': sent_2.select('SR_B4'),
    'SR_B5': sent_2.select('SR_B5')
  }).rename('BSI');
  
var mvi = sent_2.expression(
  '(SR_B4 - SR_B2) / (SR_B5 - SR_B2)',{
  'SR_B2' : sent_2.select('SR_B2'),
  'SR_B4' : sent_2.select('SR_B4'),
  'SR_B5' : sent_2.select('SR_B5')
  }).rename('MVI');

var stats_mndwi = mndwi.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});


var stats_mvi = mvi.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});

var stats_ndvi = ndvi.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});

var stats_bsi = bsi.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});

print('mdnwi Band min/max values:', stats_mndwi);
print('mvi Band min/max values:', stats_mvi);
print('ndvi Band min/max values:', stats_ndvi);
print('bsi Band min/max values:', stats_bsi);


Map.centerObject(roi, 15);
Map.addLayer(mndwi, {min: -1, max: 1, palette: ['brown', 'white', 'blue']}, 'MNDWI');
Map.addLayer(mvi, {min: -1, max: 1, palette: ['purple', 'white', 'green']}, 'MVI');
Map.addLayer(ndvi, {min: -1, max: 1, palette: ['brown', 'white', 'green']}, 'NDVI');
Map.addLayer(bsi,  {min: -1, max: 1, palette: ['blue', 'white', 'red']}, 'BSI');

var indices = sent_2.addBands([ndmi, mndwi, bsi, mvi, ndvi]);

//Sample training data
var training_data = gdp_data.filterBounds(roi);
var samples = indices.sampleRegions({
  collection: training_data,
  properties: ['class'],
  scale: 10,
  geometries: true
});

print(training_data, 'training_data')


// Split for training and testing
var split = 0.7;
var withRandom = samples.randomColumn();
var train = withRandom.filter(ee.Filter.lt('random', split));
var test = withRandom.filter(ee.Filter.gte('random', split));

// Train classifier
var classifier = ee.Classifier.smileRandomForest(500).train({
  features: train,
  classProperty: 'class',
  inputProperties: indices.bandNames()
});

var classified = indices.classify(classifier);

// Add classification layer with legend colors
var palette = [
  '#006400',  // 1 - Forest
  '#808080',   // 2 - Other
  '#4682B4',   // 3 - Wetland
  //'#FFD700'  // 4 - invasive species
];

Map.addLayer(classified, {min: 1, max: 3, palette: palette}, 'Land Cover Classification');

// ----------------------------------------
// Add Legend
// ----------------------------------------
var classNames = [
  
  'Mangrove',
  'Bareland',
  'Water',
  //'Invasive_species'
];

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    backgroundColor: 'white'
  }
});

legend.add(ui.Label({
  value: 'Land Cover Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 8px 0',
    color: 'black'
  }
}));

// Create a row in the legend for each class
function makeLegendRow(color, name) {
  var colorBox = ui.Label('', {
    backgroundColor: color,
    padding: '8px',
    margin: '0 8px 4px 0'
  });
  var label = ui.Label(name, {margin: '0 0 4px 0'});
  return ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
}

for (var i = 0; i < palette.length; i++) {
  legend.add(makeLegendRow(palette[i], classNames[i]));
}

Map.add(legend);
// Accuracy assessment
var testClassified = test.classify(classifier);
var confusionMatrix = testClassified.errorMatrix('class', 'classification');
print('Confusion Matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
print('Kappa Coefficient:', confusionMatrix.kappa());
print('User Accuracy:', confusionMatrix.consumersAccuracy());
print('Producer Accuracy:', confusionMatrix.producersAccuracy());

// After classification:
var kernel = ee.Kernel.square({radius: 1});  // 3x3 kernel

// Apply focal mode filter to reduce noise
var cleaned = classified.focal_mode({
  kernel: kernel,
  iterations: 1,
  // Can set 'skipMasked' if needed: skipMasked: true
});


// Apply NDCI function to your image collection or image
var ndci_image = addNdti(sent_2);

var stats_ndti = ndci_image.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 30,
  maxPixels: 1e9
});
print('Stats_ndti', stats_ndti);
// Now extract NDCI band and mask it with class 3
var ndciClass3 = ndci_image.select('NDTI')
                             .updateMask(classified.eq(3));

var viz = {min: -0.07, max: 0.06, palette:['cyan', 'orange', 'red']};

Map.addLayer(ndciClass3, viz, 'NDCI for Class 3');

// Display cleaned classification instead of raw
Map.addLayer(cleaned, {min: 1, max: 3, palette: palette}, 'Cleaned Land Cover Classification');

// Export classified image
Export.image.toDrive({
  image: classified,
  description: 'lc_2007',
  folder: 'Ugwana_beach_data',
  scale: 10,
  region: roi,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ndciClass3,
  description: 'water_quality_ndti_2007',
  fileNamePrefix: 'water_quality_ndti_2007',
  folder:'Ugwana_beach_data',
  region: roi,
  scale: 30,
  fileFormat: 'GeoTIFF'
});
