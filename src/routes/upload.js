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

  console.log('req.files >>>', req.files); // eslint-disable-line

  sampleFile = req.files.sampleFile;

  folderName = 'test'

  uploadPath = path.join(__dirname + '../../../data/source_files/' + folderName + '/' + sampleFile.name);
  console.log(uploadPath)

  sampleFile.mv(uploadPath, function(err) {
    if (err) {
      return res.status(500).send(err);
    }

    res.send('File uploaded to ' + uploadPath);
  });
});

module.exports = router;
