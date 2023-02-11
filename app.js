// import fetch from 'node-fetch';
import jsonfile from 'jsonfile';
import YAML from 'yamljs';
import axios from 'axios';
// const github = require('octonode');
// const config = require('config');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// let token = config.get('token');
// let client = github.client(token);
// let ghrepo = client.repo('PDIS/web-jekyll');
let discourse_site_url = 'https://talk.pdis.nat.gov.tw';
let category_name = 'pdis-site/how-we-work-track';
let remove_posts = [73] // remove "definition" post
let file = './tracks.json';
let topics = [];
let posts = [];

let getIDs = async (more_url = "") => {
    let query = '';
    if (more_url.includes("page")) {
        query = discourse_site_url + more_url.replace(/\?page/, '.json?page');
    } else {
        query = `${discourse_site_url}/c/${category_name}.json`;
    }
    console.log(`fetching url: ${query}`); // print query url
    let response = await axios.get(query)
    let data = response.data
    let topics_tmp = data.topic_list.topics;
    topics_tmp.map(t => topics.push(t.id))
    // check if there's more pages to fetch
    more_url = data.topic_list.more_topics_url || '';
    if (more_url != '') { // recursively getIDs
        await delay(500); // wait for next fetch
        await getIDs(more_url);
    }
}

let getPosts = async () => { // 取得單篇PO文
    // * remove duplicated post
    topics = topics.filter((topic, i) => topics.indexOf(topic) === i);
    // * remove "definition" post
    topics = topics.filter((topic) => remove_posts.indexOf(topic) == -1);
    for (let id of topics) {
        try {
            let response = await axios.get(`${discourse_site_url}/t/${id}.json?include_raw=1`);
            let data = await response.data;
            let post = {};
            post['id'] = data['id'];
            post['title'] = data['title'];
            post['date'] = new Date(data['created_at'].toString()).toISOString().substring(0, 10); // 2022-02-22
            post['tags'] = data['tags'];
            let raw = data['post_stream']['posts'][0]['raw'];
            post['content'] = YAML.parse(raw)['content'];
            posts.push(post);
            console.log(`Post found: ${post.title}`); // print post content
            await delay(500); // wait for next fetch
        }
        catch(e) {
            console.error(`getPost err: ${e}`);
        }
    }
}

let updateFile = () => {
    // save file locally
    jsonfile.writeFile(file, posts, function (e) {
        if (e) {
          console.error(`updateFile err: ${e}`);
        }
        else {
          console.log('wrote file successfully')
        }
    })
}

let triggerGithub = () => {
    // * trigger GitHub Actions workflow API
    fetch('https://api.github.com/repos/PDIS/web-jekyll/actions/workflows/github-pages-deploy.yml/dispatches', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': 'token ' + token
        },
        body: '{"ref": "master"}'
    })
    .then(res => {
        if (res.status == 204) {
            console.log('done')
        } else {
	    console.log(res.statusText)
        }
    });
}

let gitcommit = () => {
    let stringdata = JSON.stringify(posts);
    ghrepo.contents('_data/tracks.json', function (err, data, headers) {
        console.error("error: " + err);
        if (typeof data == 'undefined' || typeof data === null) {
            ghrepo.createContents('_data/tracks.json', 'create tracks.json', stringdata, function (err, data, headers) {
                console.error("error: " + err);
                console.error("data: " + JSON.stringify(data));
            });
        } else {
            let sha = data.sha;
            ghrepo.updateContents('_data/tracks.json', 'update tracks.json', stringdata, sha, function (err, data, headers) {
                console.error("error: " + err);
            });
        }
    });
}

getIDs()
  .then(getPosts)
  .then(updateFile)
  // .then(triggerGithub)
  // .then(gitcommit)
