# rollingshutter
An implementation of the rollingshutter effect in the browser using WebGL and getUserMedia

The code is divided between javascript files and shader scripts, which currently reside in the html file.
See it in action at [my website](https://jtgriffin.co.uk/rollingshutter/webgl/).

## Instructions

After downloading the source, run a local webserver and open index.html in your favourite web browser. I use
```
python3 -m http.server 8000
```
then open `localhost:8000`.

Then get up from your desk, make sure you're in shot and give us a spin.  Then watch the results.

## What is the rolling shutter effect?
The rolling shutter effect is caused when different lines in an image are displaced by different amounts in time.  It is like a skew map, but in the time dimension.  Typically this is caused by the workings of a camera sensor, where lines are read in series.  Thus there is a small delay, perhaps 20ms, between recording of the lines at the very top, and very bottom of an image.

However we can also recreate the rolling shutter effect from a series of images.  In the output image the pixels values are taken from corresponding pixels in different source images, which source image depends on the position of
the pixel.

## What does this code do?
Each frame two things happen:

1. An image from the webcam is taken and then recorded into a cyclic buffer in graphics memory.  
2. An output image is rendered from the last n frames (default, n = 96).  The output image is split into 96 slices (determined either by a direction vector, or by an image mask).  The pixel values are then taken from the corresponding slice.

For example, the default setup splits the output image into 96 slices.  In the top slice the most recent frame is display, in the next one down the second most recent and so on, until the bottom slice, which is 96 frames old.

## How the frame buffer works
The default behaviour for the frame buffer uses two textures, each 4096&times;4096 pixels in size.  Within each texture there is a 6&times;8 grid of 640&times;480 cells.  These are numbered 0 to 95 and in frame number t, the input frame from the webcam is written to cell t % 96.  This uses the simplest passthrough fragment shader possible.  The choice of the 2 textures and the position to be written to is determined in javascript.

When rendering the output, all the calculations are done in a fragment shader.

## Limitations

### Framerate

So far all the devices / browsers I've tested render at 60 fps, with the exception of anything Apple related which doesn't implement getUserMedia.  However the main limitation is the framerate of the webcam input.  This varies between devices, but on most I've tried are in the region 24-30 fps.  This means that a lot of the data in the frame buffer is replicated and working at 60fps is unnecessary.  However, using a PS Eye webcam a full 60fps are supplied to the browser and the effect is noticeably improved.  Mobile devices appear to supply similar framerates, though I haven't measured precisely.

If higher framerates are possible (I haven't checked), then it would be worth rendering more frequently to the frame buffer and potentially extending it to use more frames.  There is no reason why the 60fps output has to match the frequency of writing to the frame buffer, in fact when the framerate is lower it would be worth writing less frequently and having a slower, but higher quality, effect.

### Resolution

It is worth noting that the larger the screen, the more striking the effect, and that low resolutions are not a concern for moving video.

It is quite simple to take screenshots within javascript which just grab the canvas element blob.  However here resolution, and the size of the frame buffer seriously limit the visual quality.

### Aspect Ratio

There is no reason the aspect ratio is stuck at 4:3, except for convenience.  This can easily be changed and will be when I get the chance, there is no reason not to use native aspect ratios.

### Secure origins

Although this may vary between browsers, in most getusermedia is disable on insecure origins.  This policy pushed me to https-ify my website.
