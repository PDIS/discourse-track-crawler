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
let file = '/var/discourse/api/tracks.json'

let getIDs = async (more_url) => {
    if (more_url == '') {
        query = "http://talk.pdis.nat.gov.tw/c/pdis-site/how-we-work-track.json";
    } else {
        query = "http://talk.pdis.nat.gov.tw" + more_url.replace(/\?page/, '.json?page');
    }
    let response = await fetch(query);
    let data = await response.json()
    more_url = data.topic_list.more_topics_url || ''
    let topics_tmp = data.topic_list.topics
    // topics_tmp.splice(0,1) // remove first post (duplicated)
    topics_tmp.map(t => topics.push(t.id))
    if (more_url != '') { // recursively getIDs
        let ids = await getIDs(more_url);
    }
}

let getPosts = async () => { // 取得單篇PO文
    // * remove duplicated post
    topics = topics.filter((topic, i) => topics.indexOf(topic) === i)
    // * remove "definition" post
    topics = topics.filter((topic, i) => topic != '73')
    for (let id of topics) {
        try {
            let response = await fetch('http://talk.pdis.nat.gov.tw/t/' + id + ".json?include_raw=1")
            let data = await response.json()
            let post = {};
            post['id'] = data['id']
            post['title'] = data['title'];
            post['date'] = await new Date(data['created_at'].toString()).toISOString().substring(0, 10);
            post['tags'] = data['tags'];
            let raw = data['post_stream']['posts'][0]['raw'];
            post['content'] = YAML.parse(raw)['content'];
            posts.push(post);
        }
        catch(e) {
            console.error(e)
        }
    }
}

let updateFile = () => {
    jsonfile.writeFile(file, posts, function (err) {
        console.error(err)
    })
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
            ghrepo.createContents('_data/tracks.json', 'update tracks.json', stringdata, function (err, data, headers) {
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

// getIDs(more_url).then(getPosts).then(gitcommit)
getIDs(more_url).then(getPosts).then(updateFile)
