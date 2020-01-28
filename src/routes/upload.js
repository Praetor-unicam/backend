const express = require('express');
const router = express.Router();
const path = require('path');

router.post('/', function(req, res) {
  let sampleFile;
  let uploadPath;

  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
    return;
  }

  console.log(req);

  console.log('req.files >>>', req.files); // eslint-disable-line

  sampleFile = req.files.sampleFile;


  console.log(res.body)
  if (req.body.filename == null || !req.body.format == null || !req.body.country == null) {
    res.status(400).send('Some info is missing.');
    return;
  }


  filename = req.body.filename.toLowerCase();
  format = req.body.format.toLowerCase();
  folderName = req.body.country.toLowerCase();

  uploadPath = path.join(__dirname + '../../../data/source_files/' + folderName + '/' + filename + '.' + format);
  console.log(uploadPath)

  sampleFile.mv(uploadPath, function(err) {
    if (err) {
      const fail = path.join(__dirname + '../../../upload_data/error.html');
      return res.sendFile(fail);
    }

    const success = path.join(__dirname + '../../../upload_data/success.html');
    res.sendFile(success);
  });
});

module.exports = router;
