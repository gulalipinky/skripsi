Map.centerObject(table);

// Terapkan cloud mask
var maskClouds = function(image) {
  var qa = image.select('QA_PIXEL');
  var cloud = qa.bitwiseAnd(1 << 5).and(qa.bitwiseAnd(1 << 7)).or(qa.bitwiseAnd(1 << 3));
  var mask2 = image.mask().reduce(ee.Reducer.min());
  return image.updateMask(cloud.not()).updateMask(mask2);
};

var composite = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
  .filterMetadata('CLOUD_COVER', 'less_than',60 )
  .map(maskClouds)
  .filterDate('2021-02-01', '2022-12-28')
  .median()
  .clip(table);
  
print(composite)  

//menampilkan citra tanpa awan
Map.addLayer(composite,{bands: ['B4','B3','B2'], min:0, max: 0.3},  'tanpa awan');


//var bands = ["B2", "B3", "B4", "B5", "B6", "B7"];
//var composite = composite.select(bands);

// Fungsi IHS
var hsv = composite.select(['B4', 'B3', 'B2']).rgbToHsv();
var sharpenedRGB = ee.Image.cat([
  hsv.select('hue'), hsv.select('saturation'), composite.select('B8')
]).hsvToRgb();

// Combine sharpened RGB with B4, B5, B6, B7
var sharpened = sharpenedRGB.addBands(composite.select([ 'B5', 'B6', 'B7']));

// Fungsi Brovey transformation
ar broveyTransform = function(image) {
  var pan = image.select('B8');
  var rgb = image.select(['B4', 'B3', 'B2']);
  
  // Jumlahkan band RGB
  var sumRgb = rgb.reduce(ee.Reducer.sum());
  
  // Hitung rasio Brovey
  var broveyTransformed = pan.multiply(rgb).divide(sumRgb).toFloat();
  
  // Gabungkan hasil dengan band lain jika diperlukan
  return broveyTransformed.addBands(image.select(['B5', 'B6', 'B7']));
};

// Terapkan Brovey transformation ke citra komposit
var broveySharpened = broveyTransform(composite);

// Penyesuaian gamma setelah transformasi Brovey
var gamma = 1.5;
var broveyGammaAdjusted = broveySharpened.pow(ee.Image.constant(1 / gamma));



// Fungsi Gram-Schmidt

var gramSchmidt = function(image) {
  var pan = image.select('B8');  // Pilih band pankromatik (misalnya B8 untuk Landsat)
  var rgb = image.select(['B4', 'B3', 'B2']);  // Pilih band RGB (misalnya B4, B3, B2 untuk Landsat)
  
  // Normalisasi citra pankromatik
  var meanPan = pan.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: table,
    scale: 30,  // Sesuaikan dengan resolusi citra
    maxPixels: 1e9
  }).values().get(0);
  
  var panNorm = pan.divide(ee.Image.constant(meanPan));
  
  // Proses Gram-Schmidt
  var gs = ee.ImageCollection.fromImages(
    rgb.bandNames().map(function(bandName) {
      var band = rgb.select([bandName]);
      var a = panNorm.multiply(band).reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: table,
        scale: 30,  // Sesuaikan dengan resolusi citra
        maxPixels: 1e9
      }).values().get(0);
      
      var b = panNorm.multiply(panNorm).reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: table,
        scale: 30,  // Sesuaikan dengan resolusi citra
        maxPixels: 1e9
      }).values().get(0);
      
      return panNorm.multiply(ee.Number(a).divide(ee.Number(b))).rename([bandName]).toFloat();
    })
  ).toBands().rename(rgb.bandNames());
  
  // Citra hasil penajaman
  var sharpened = gs.addBands(image.select(['B5', 'B6', 'B7']));  // Tambahkan band lain seperti NIR, SWIR jika diperlukan
  
  return sharpened;
};

// Terapkan transformasi Gram-Schmidt
var sharpenedGramSchmidt = gramSchmidt(composite);
Map.addLayer(sharpened, {bands: ['red', 'green', 'blue'], min:0, max: 0.3}, 'IHS Sharpened');
// Tampilkan hasil Gram-Schmidt transformation pada peta
Map.addLayer(sharpenedGramSchmidt, {bands: ['B4', 'B3', 'B2'], min:0, max: 0.3}, 'Gram-Schmidt Composite');
// Tampilkan hasil Brovey transformation pada peta
Map.addLayer(broveyGammaAdjusted, {bands: ['B4', 'B3', 'B2'], min:0, max: 0.3}, 'Brovey Sharpened');


Export.image.toDrive({
 image: sharpened,
 description: "Landsat-8-table-2022-IHS",
 scale: 30,
 region: table,
 maxPixels:3e10
});

print(sharpened)
 

// Ekspor citra
Export.image.toDrive({
  image: sharpenedGramSchmidt,
  description: "Landsat-8-table-2022--GramSchmidt",
  scale: 30,
  region: table,
  maxPixels:3e10
});

print(sharpenedGramSchmidt);


// Ekspor hasil Brovey transformation ke Google Drive
Export.image.toDrive({
 image: broveyGammaAdjusted,
 description: "Landsat-8-table-2022-Brovey",
 scale: 30,
 region: table,
 maxPixels:3e10
})