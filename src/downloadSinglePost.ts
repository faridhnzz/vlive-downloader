import needle from "needle";
import cliProgress from "cli-progress";
import fs from "fs";
import path from "path";
import { VliveDownloader } from "./vliveDownloader";

const downloadSinglePost = async (vliveUrl: string) => {
  try {
    const isVliveUrl = vliveUrl.includes("vlive.tv/post");
    let postId = "";

    if (isVliveUrl) {
      postId = vliveUrl.split("/").pop() as string;
    } else {
      throw new Error("Not vlive url");
    }

    const downloader = new VliveDownloader(postId);
    await downloader.getPostData();
    await downloader.getVideoKey();
    await downloader.getVideoMetaData();
    downloader.withCategory();

    const validPath = path.normalize(downloader.videoData.data.title.replace(/[^a-zA-Z0-9 ]/g, ""));
    if (!fs.existsSync(validPath)) {
      fs.mkdirSync(validPath);
    }

    const captionsList = downloader.videoData.data.captions;
    for (let caption of captionsList) {
      const url = caption.source;
      const data = await needle("get", url).then((res) => res.body);

      const splitedUrl = url.split("/").pop() as string;
      const filename = splitedUrl.split("_");
      filename.shift();

      fs.writeFileSync(`./${validPath}/${validPath}_${filename.join("_")}`, data);
    }

    let data = JSON.stringify(downloader.videoData.data, null, 2);
    fs.writeFileSync(`./${validPath}/videoData.json`, data);

    const progressBar = new cliProgress.SingleBar(
      {
        format: "[\u001b[32m{bar}\u001b[0m] {percentage}% | ETA: {eta}s | {value}/{total} => " + downloader.videoData.data.title,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
        barGlue: "\u001b[33m",
      },
      cliProgress.Presets.shades_classic
    );

    let receivedBytes = 0;
    const videoPath = path.resolve(`${validPath}`, `${validPath}.mp4`);

    needle
      .get(downloader.videoUrl!)
      .on("response", (response) => {
        const totalBytes = response.headers["content-length"];
        progressBar.start(totalBytes, 0);
      })
      .on("data", (chunk) => {
        receivedBytes += chunk.length;
        progressBar.update(receivedBytes);
      })
      .pipe(fs.createWriteStream(videoPath))
      .on("done", function (err) {
        progressBar.stop();
      });

    return Promise.resolve(true);
  } catch (error) {
    console.log(error);
  }
};

export default downloadSinglePost;
