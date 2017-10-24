const fetch = require('node-fetch');
const jsonfile = require('jsonfile')
const YAML = require('yamljs');
const github = require('octonode');
const config = require('config');

let token = config.get('token');
let client = github.client(token);
let ghrepo = client.repo('PDIS/web-jekyll');

let more_url = '';
let topics = [];
let posts = [];
let file = 'data.json'


let getIDs = async (more_url) => {
    if (more_url == '') {
        query = "https://talk.pdis.nat.gov.tw/c/pdis-site/how-we-work-track.json";
    } else {
        query = "https://talk.pdis.nat.gov.tw/" + more_url.replace(/latest/, 'latest.json');
    }
    let response = await fetch(query);
    let data = await response.json()
    more_url = data.topic_list.more_topics_url || ''
    data.topic_list.topics.map(topic => topics.push(topic['id']));
    if (topics[0] == '73') {
        topics.splice(0, 1)
    }
    if (more_url != '') {
        let ids = await getIDs(more_url);
    }
}

let getPosts = async () => { // 取得單篇PO文
    for (let id of topics) {
        let response = await fetch('https://talk.pdis.nat.gov.tw/t/' + id + ".json?include_raw=1")
        let data = await response.json()
        let post = {};
        post['id'] = data['id']
        post['title'] = data['title'];
        post['date'] = await new Date(data['created_at'].toString()).toISOString().substring(0, 10);
        post['tags'] = data['tags'];
        // post['content'] = data['post_stream']['posts'][0]['raw'];
        let raw = data['post_stream']['posts'][0]['raw'];
        post['content'] = YAML.parse(raw)['content'];
        posts.push(post);
    }
}

let writeFile = () => {
    jsonfile.writeFile(file, posts, function (err) {
        console.error(err)
    })
}

let gitcommit = () => {
    let stringdata = JSON.stringify(posts);
    ghrepo.contents('_data/tracks.json', function (err, data, headers) {
        console.log("error: " + err);
        let sha = data.sha;
        ghrepo.updateContents('_data/tracks.json', 'update tracks.json', stringdata, sha, function (err, data, headers) {
            console.log("error: " + err);
        });
    });
    //create file
    /* ghrepo.createContents('_data/tracks.json', 'update tracks.json', stringdata, function (err, data, headers) {
        console.log("error: " + err);
        console.log("data: " + JSON.stringify(data));
    }); */
}

getIDs(more_url).then(getPosts).then(gitcommit)