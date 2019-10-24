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
        query = "http://talk.pdis.nat.gov.tw/c/pdis-site/how-we-work-track.json";
    } else {
        query = "http://talk.pdis.nat.gov.tw/" + more_url.replace(/latest/, 'latest.json');
    }
    let response = await fetch(query);
    let data = await response.json()
    more_url = data.topic_list.more_topics_url || ''
    //data.topic_list.topics.map(topic => topics.push(topic['id']));
    let topic = data.topic_list.topics
    topic.splice(0,1)
    topic.map(t => topics.push(t.id))
    if (topics[0] == '73') {
        topics.splice(0, 1)
    }
    for (let i in topics) {
        if (topics[i+1] == topics[i])
        {
            console.log(topics[i+1],topics[i])
            topics.splice(i,i+1)
        }
    }
    if (more_url != '') {
        let ids = await getIDs(more_url);
    }
}

let getPosts = async () => { // 取得單篇PO文
    for (let id of topics) {
        try {
            let response = await fetch('http://talk.pdis.nat.gov.tw/t/' + id + ".json?include_raw=1")
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
        catch(e) {
            console.log(e)
        }
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
        if (typeof data == 'undefined' || typeof data === null) {
            ghrepo.createContents('_data/tracks.json', 'update tracks.json', stringdata, function (err, data, headers) {
                console.log("error: " + err);
                console.log("data: " + JSON.stringify(data));
            });
        } else {
            let sha = data.sha;
            ghrepo.updateContents('_data/tracks.json', 'update tracks.json', stringdata, sha, function (err, data, headers) {
                console.log("error: " + err);
            });
        }
    });
    //create file
    /* ghrepo.createContents('_data/tracks.json', 'update tracks.json', stringdata, function (err, data, headers) {
        console.log("error: " + err);
        console.log("data: " + JSON.stringify(data));
    }); */
}

getIDs(more_url).then(getPosts).then(gitcommit)
