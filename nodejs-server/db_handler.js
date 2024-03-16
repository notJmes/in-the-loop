const fs = require('fs');
const path = require('path');

function update_json(json = {}, fname = 'qns.json') {

    if (!fs.existsSync(`./${fname}`)) {
        fs.mkdirSync(path.dirname(fname), { recursive: true });
        fs.writeFileSync(fname, JSON.stringify(json, null, 2), 'utf8');
        return console.log(`Created new file! ${fname}`)
    };
    if (!json) return console.log(`No data to update for ${fname}!`);
    let file
    try{
        file = require(`./${fname}`);
    }catch{
        fs.writeFileSync(fname, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Added JSON format! ${fname}`)
        file = require(`./${fname}`);
    }

    for (key in json) {
        if (file.hasOwnProperty(key)) {
            for (name in json[key]) {
              // TODO: if name already present, ask if wanna resubmit
              if (file[key].hasOwnProperty(name)) {
                console.log(`${name} already in ${key}`)    
              };
              file[key][name] = json[key][name];
              console.log(`Saving record for ${name} in ${key}`);
                
            };
        } else {
            file[key] = json[key];
            console.log(`Updating entire record for ${key}`)
        };
        
    };
    let formatted_json = JSON.stringify(file, null, 2);
    console.log(`Latest contents of file should be \n${formatted_json}`)
    fs.writeFile(fname, formatted_json , 'utf8', callback = (err) => {}); // write it back

};

function name_exist(issue, name, ans_path){
    if (!fs.existsSync(ans_path)){
        return false
    };
    const file = require(ans_path);
    console.log(file[issue]);
    if (file.hasOwnProperty(issue) && file[issue].hasOwnProperty(name)){
        return true
    }else{
        return false
    }
};

module.exports = {update_json: update_json,
                    name_exist: name_exist};