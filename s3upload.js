/**
 * Taken, CommonJS-ified, and heavily modified from:
 * https://github.com/flyingsparx/NodeDirectUploader
 */

var Evaporate = require('evaporate'),
    AWS = require('aws-sdk');

S3Upload.prototype.server = '';
S3Upload.prototype.signingUrl = '/sign-s3';
S3Upload.prototype.signingUrlMethod = 'GET';
S3Upload.prototype.signingUrlSuccessResponses = [200, 201];
S3Upload.prototype.fileElement = null;
S3Upload.prototype.files = null;

S3Upload.prototype.onFinishS3Put = function(signResult, file) {
    return console.log('base.onFinishS3Put()', signResult.publicUrl);
};

S3Upload.prototype.preprocess = function(file, next) {
    console.log('base.preprocess()', file);
    return next(file);
};

S3Upload.prototype.onProgress = function(percent, status, file) {
    return console.log('base.onProgress()', percent, status);
};

S3Upload.prototype.onError = function(status, file) {
    return console.log('base.onError()', status);
};

S3Upload.prototype.scrubFilename = function(filename) {
    return filename.replace(/[^\w\d_\-\.]+/ig, '');
};

function S3Upload(options) {
    if (options == null) {
        options = {};
    }
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    var files = this.fileElement ? this.fileElement.files : this.files || [];
    this.handleFileSelect(files);
}

S3Upload.prototype.handleFileSelect = function(files) {
    var result = [];
    for (var i=0; i < files.length; i++) {
        var file = files[i];
        this.preprocess(file, function(processedFile){
          this.onProgress(0, 'Waiting', processedFile);
          result.push(this.uploadFile(processedFile));
          return result;
        }.bind(this));
    }
};

S3Upload.prototype.uploadToS3 = function(file) {
    return Evaporate.create({
      signerUrl: this.signingUrl,
      aws_key: this.awsKey,
      bucket: this.awsBucket,
      computeContentMd5: true,
      cryptoMd5Method: (data) => { return AWS.util.crypto.md5(data, 'base64'); },
      cryptoHexEncodedHash256: (data) => { return AWS.util.crypto.sha256(data, 'hex'); }
    }).then((evaporate) => {
      const addConfig = {
        name: this.s3Path + file.name,
        file: file,
        progress: (progressValue) => {
          return this.onProgress(progressValue, progressValue === 100 ? 'Finalizing' : 'Uploading', file);
        },
        complete: (_xhr, awsKey) => {
          if (_xhr.status === 200) {
            this.onProgress(100, 'Upload completed', file);
            console.log(awsKey);
            return this.onFinishS3Put({}, file);
          } else {
            return this.onError('Upload error: ' + _xhr.status, file);
          }
        },
        error: (msg) => {
          return this.onError(msg, file);
        }
      };
      this.evaporate = evaporate;
      evaporate.add(addConfig).then(
        (awsKey) => {
          return this.onFinishS3Put({}, file);
        },
        (errorReason) => {
          return this.onError(errorReason, file);
        }
      );
    });

    // var xhr = this.createCORSRequest('PUT', signResult.signedUrl);
    // if (!xhr) {
    //     this.onError('CORS not supported', file);
    // } else {
    //     xhr.onload = function() {
    //         if (xhr.status === 200) {
    //             this.onProgress(100, 'Upload completed', file);
    //             return this.onFinishS3Put(signResult, file);
    //         } else {
    //             return this.onError('Upload error: ' + xhr.status, file);
    //         }
    //     }.bind(this);
    //     xhr.onerror = function() {
    //         return this.onError('XHR error', file);
    //     }.bind(this);
    //     xhr.upload.onprogress = function(e) {
    //         var percentLoaded;
    //         if (e.lengthComputable) {
    //             percentLoaded = Math.round((e.loaded / e.total) * 100);
    //             return this.onProgress(percentLoaded, percentLoaded === 100 ? 'Finalizing' : 'Uploading', file);
    //         }
    //     }.bind(this);
    // }
    // xhr.setRequestHeader('Content-Type', file.type);
    // if (this.contentDisposition) {
    //     var disposition = this.contentDisposition;
    //     if (disposition === 'auto') {
    //         if (file.type.substr(0, 6) === 'image/') {
    //             disposition = 'inline';
    //         } else {
    //             disposition = 'attachment';
    //         }
    //     }

    //     var fileName = this.scrubFilename(file.name)
    //     xhr.setRequestHeader('Content-Disposition', disposition + '; filename="' + fileName + '"');
    // }
    // if (signResult.headers) {
    //     var signResultHeaders = signResult.headers
    //     Object.keys(signResultHeaders).forEach(function(key) {
    //         var val = signResultHeaders[key];
    //         xhr.setRequestHeader(key, val);
    //     })
    // }
    // if (this.uploadRequestHeaders) {
    //     var uploadRequestHeaders = this.uploadRequestHeaders;
    //     Object.keys(uploadRequestHeaders).forEach(function(key) {
    //         var val = uploadRequestHeaders[key];
    //         xhr.setRequestHeader(key, val);
    //     });
    // } else {
    //     xhr.setRequestHeader('x-amz-acl', 'public-read');
    // }
    // this.httprequest = xhr;
    // return xhr.send(file);
};

S3Upload.prototype.uploadFile = function(file) {
    return this.uploadToS3(file);
};

S3Upload.prototype.abortUpload = function(filename) {
    return this.evaporate && this.evaporate.cancel(this.awsBucket + '/' + filename);
};

module.exports = S3Upload;
