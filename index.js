const puppeteer = require('puppeteer');
const {Storage} = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const https = require('https')

const storage = new Storage();

const bucketName = 'pixteller';
const filename = 'screenshot.png';
const screenshotPath = '/tmp/' + filename;
const optimizedScreenshotPath = '/tmp/optimized.png'


exports.screenshot = async (req, res) => {
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});


    const page = await browser.newPage();
    await page.goto('https://google.com');
    await page.screenshot({
        path: screenshotPath,
    });

    const bucket = storage.bucket(bucketName);
    const bucketOptions = {
        destination: 'puppeteer_screenshots/' + filename,
        gzip: true,
    };

    await browser.close();

    let cmd = ffmpeg(screenshotPath)
        .clone()
        .size('300x300')
        .save(optimizedScreenshotPath)
        .on('end', async () => {
            // Finished processing the video.
            console.log('Done resizing');

            await bucket.upload(optimizedScreenshotPath, bucketOptions);
            let pathInBucket = "gs://" + bucketName + "/screenshots/" + filename;
            console.log("Created object" + pathInBucket );

            var options = {
                hostname: 'localhost',
                port: 443,
                path: '/post.php',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                rejectUnauthorized: false,
            };

            var req = https.request(options, (res) => {
                console.log('statusCode:', res.statusCode);
                console.log('headers:', res.headers);

                res.on('data', (d) => {
                    process.stdout.write(d);
                });
            });

            req.on('error', (e) => {
                console.error(e);
                res.send('Error while sending the request to our API');
            });

            req.write(JSON.stringify(
                {
                    bucket: bucketName,
                    filename: filename,
                    URI: pathInBucket
                }
            ));
            req.end();

            res.send('Done. Phew!');


        });


};