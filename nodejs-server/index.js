const { update_json, name_exist } = require('./db_handler.js');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cron = require('node-cron');
const path = require('path');
const express = require('express');
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let img_path = path.join(user_store_path, req.cookies.group, 'images')
        fs.mkdirSync(img_path, {recursive: true }, err => {})
        return cb(null, img_path)
    },
    filename: (req, file, cb) => {
	let fname = issue + '_' +req.cookies.name + '.' +file.originalname.split('.').slice(-1);
        console.log(`Saving image as ${fname}`);
	cb(null, fname);
    }
})
const upload = multer({storage: storage})
const bodyParser = require('body-parser');

const fs = require('fs');
const { group } = require('console');

const app = express();
const port = process.env.PORT || 3000;
const session_store = new session.MemoryStore();

// const ans_path = './user_store/ans.json'
const user_store_path = './user_store'

app.use(cookieParser());

let issue_no = 1
let date = new Date();
// let issue = `issue${issue_no}_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear().toString().substr(-2)}`; 
let issue = `issue_${date.getMonth() + 1}-${date.getFullYear().toString().substr(-2)}`; 
let qns = ['⛅ One Good Thing', '💭 On Your Mind', '👀 Check it Out']

function checkExpiry (req, res, next) {
   
   if (req.method === 'POST') {
     //res.cookie('name', name.toString('utf8'), { maxAge: 900000, httpOnly: true });
     console.log('request body')
     console.log(req.cookie)
   }

   // keep executing the router middleware
   next()
}

//app.use(checkExpiry) //clean up this code next time



app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    }),
);
let qns_obj = {};
qns_obj[issue] = qns;
update_json(json=qns_obj, fname='qns.json');
// update_json({}, fname=ans_path);
console.log('initialised!');
app.use(session({
    secret: 'lettersloop',
    cookie: {maxAge: 30000},
    saveUninitialized: true,
    store: session_store
}))

app.get('/', (request, response) => {
    
    try{
        let name = Buffer.from(request.query.n, 'base64');
        let group = Buffer.from(request.query.g, 'base64');
    }catch{
        return response.render('error')
    }

    let name = Buffer.from(request.query.n, 'base64');
    let group = Buffer.from(request.query.g, 'base64');

    response.cookie('name', name.toString('utf8'), { maxAge: 900000, httpOnly: true }); 
    response.cookie('group', group.toString('utf8'), { maxAge: 900000, httpOnly: true }); 

    // DEBUG INFO
    console.log(request.sessionID);
    console.log(request.session.name);
    console.log(session_store)
    console.log(request.cookies.name);

    let ans_path = get_store_path(group.toString('utf8'));
    let name_flag = name_exist(issue, name, ans_path);
    
    response.render('index', {
        name: name,
        qns: qns,
        name_flag: name_flag
    });
    
});

app.post('/submit', upload.single('image'), (request, response) => {
    console.log(`Submitted!`);
    console.log(request.session.name);
    let data = request.body;
    
    let qns = {};
    
    for (let qn in data) {
        if (qn.startsWith("qn")) {
            qns[qn] = data[qn];
        };
    };
    
    let jsn = {};
    
    let tmp_date = new Date();
    if (tmp_date.getMonth()!==date.getMonth()){
        issue_no += 1;
        date = tmp_date;
        issue=`issue_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear().toString().substr(-2)}`; 
        console.log(`Updated issue date to ${issue}!`)
    }else{
        console.log('No changes to issue date')
    };

    jsn[issue] = {[request.cookies.name] : qns};
    console.log(JSON.stringify(jsn));


    let group = request.cookies.group;
    
    let ans_path = get_store_path(group);

    update_json(json=jsn, fname=ans_path); // User answers
    
    let encoded_name = Buffer.from(request.cookies.name).toString('base64');
    let encoded_group = Buffer.from(request.cookies.group).toString('base64');
    
    response.redirect(303, '/?n='+encoded_name+'&g='+encoded_group);
});

app.get('/gen', (request, response) => {

    let group = Buffer.from(request.query.g, 'base64').toString();

    let flag = gen_newsletter(group);
    if (flag) {
        response.set('Content-Type', 'text/html');
        response.send(Buffer.from('OK'));
    }else{
        return response.status(400).send({
            message: 'Please provide a valid chat id'
         });
    };
    
});


function get_store_path(group){
    return path.join(__dirname, user_store_path, group, 'ans.json');
};

function gen_newsletter(group){

    if (typeof group === 'undefined'){
        return false;
    };

    let ans_path = get_store_path(group);

    console.log(ans_path)
    // Take user data
    console.log(fs.existsSync(ans_path))

    let answers = require(ans_path);

    console.log(answers)
    let users = answers[issue];
    let issue_formatted = issue.split('_').slice(1).join('/');
    console.log('OK', answers[issue], qns, issue_formatted)
    let img_ls = {};
    fs.readdirSync(path.join('user_store', group, 'images')).forEach(file => {
   
            console.log(file);
            if (file.includes(issue)){
                console.log('found pic!')
                let parsed = path.parse(file);
                let name = parsed.name;
                img_ls[name.split('_').slice(-1)] = file;
            };

    });
    console.log(img_ls);
    app.render('newsletter_base',{
        users: users,
        qns: qns,
        issue: issue_formatted,
        img_ls: img_ls,
        group: group
    } ,function (err, html) {
        fs.mkdirSync(`./generated/${group}/${issue}.html`, {recursive: true }, err => {})
        fs.writeFileSync(`./generated/${issue}.html`, html)
    });

    // app.render('error',function (err, html) {
    //     fs.writeFileSync(`./generated/${issue}.html`, html)
    // });

    return true;
};

app.set('view engine', 'ejs');
app.use(express.json());
app.use('/answers', express.static(__dirname+'/user_store'));
app.use('/archive/:group', express.static(__dirname+'/generated', {redirect: false}))

// cron.schedule('* * * 14 * *', () => {
//     gen_newsletter();
// });

app.listen(port, () => {
    console.log(`Application listening on port ${port}`)
    // gen_newsletter();
});
