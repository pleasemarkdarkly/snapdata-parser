const fs = require("fs");
const es = require("event-stream");

var snapcards = [],
    snapcardParsed = [];

var filters = [
    { id: 'firstName', title: "First Name", regExp: /(?<=First Name=)(.*)/ },
    { id: 'lastName', title: "Last Name", regExp: /(?<=Last Name=)(.*)/ },
    { id: 'email', title: "Email", regExp: /(?<=Email=)(.*)/ },
    { id: 'state', title: "State", regExp: /(?<=State=)(.*)/ },
    { id: 'company', title: "Company", regExp: /(?<=Company=)(.*)/ },
];

/*
var filters = [
    { id: 'business', title: "Business", regExp: /(?<=Business=)(.*)/ },
    //    { id: 'name', title: "Name", regExp: /(?<=Name=)(.*)/ },
    { id: 'firstName', title: "First Name", regExp: /(?<=First Name=)(.*)/ },
    { id: 'lastName', title: "Last Name", regExp: /(?<=Last Name=)(.*)/ },

    //   { id: 'header', title: "Title", regExp: /(?<=Header=)(.*)/ },
    { id: 'company', title: "Company", regExp: /(?<=Company=)(.*)/ },
    //    { id: 'nameAndAddresslLine0', title: "Name and Address Line (0)", regExp: /(?<=Name and Address*line0=)(.*)/ },
    //    { id: 'nameAndAddresslLine1', title: "Name and Address Line (1)", regExp: /(?<=Name and Address*line1=)(.*)/ },
    //    { id: 'nameAndAddresslLine2', title: "Name and Address Line (2)", regExp: /(?<=Name and Address*line2=)(.*)/ },

    //    { id: 'city', title: "City", regExp: /(?<=City=)(.*)/ },
    { id: 'state', title: "State", regExp: /(?<=State=)(.*)/ },
    //   { id: 'zip', title: "Zip", regExp: /(?<=Zip=)(.*)/ },
    //   { id: 'phone', title: "Phone", regExp: /(?<=Phone=)(.*)/ },
    { id: 'email', title: "Email", regExp: /(?<=Email=)(.*)/ },
];
*/

var filename = function (str) {
    return str
        .split("\\")
        .pop()
        .split("/")
        .pop();
};

function read_stream_file(filename, done) {
    const record = {};
    fs
        .createReadStream(filename)
        .pipe(es.split())
        .pipe(
            es
                .mapSync(function (line) {
                    filters.map(filter => {
                        if (line.match(filter.regExp))
                            record[filter.id] = line.match(filter.regExp)[0];
                    })
                })
                .on("error", function (err) { done(err, null) })
                .on("end", function () { done(null, record) })
        );
}

var path = require('path');

function filewalker(dir, done) {
    let results = [];

    fs.readdir(dir, function (err, list) {
        if (err) return done(err);

        var pending = list.length;

        if (!pending) return done(null, results);

        list.forEach(function (file) {
            file = path.resolve(dir, file);

            fs.stat(file, function (err, stat) {
                // If directory, execute a recursive call
                if (stat && stat.isDirectory()) {
                    // Add directory to array [comment if you need to remove the directories from the array]
                    results.push(file);

                    filewalker(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);

                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

function parse(files, done) {
    const snapcardParsed = [];
    let i = 0;
    files.forEach((file) => {
        read_stream_file(file, function (err, record) {
            if (err) console.log(err);
            else snapcardParsed.push(record)
            if (++i === files.length) done(snapcardParsed);
        });
    });
}

function writeCSV(snapcardParsed) {
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const csvWriter = createCsvWriter({
        path: 'file.csv',
        header: filters
    });

    const records = snapcardParsed;

    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('Converting CSV Done...');
        });

}

function writeCLI(snapcardParsed) {
    var Table = require('cli-table');

    var table = new Table({
        head: filters.map(({ title }) => title)
    });

    snapcardParsed.map((row) => {
        table.push(filters.map(filter => row[filter.id]))
    });

    console.log(table.toString());
}

(function main() {
    const { program } = require('commander');

    program
        .version('0.0.1')
        .option('-p, --path <path>', 'indicate Snapdata folder')
        .option('-c, --csv', 'convert to csv')
        .option('-d, --debug', 'debug');

    program.parse(process.argv);

    if (program.path === undefined) {
        console.log("Provide the Snapdata folder as a command line argument");
        console.log("i.e. node ./index.js ./Snapdata/Hay/Cards/");
        process.exit();
    }

    filewalker(program.path, (err, results) => {
        if (err) {
            throw err;
        }

        snapcards = results;

        parse(results, (parsedResults) => {
            snapcardParsed = parsedResults;
            console.log('Parse Done...');
            if (program.csv)
                writeCSV(parsedResults);
            if (program.debug)
                writeCLI(parsedResults);
        });
    });

    process.on("exit", () => {
        console.log("Total Snapcards No.: " + snapcards.length);
        console.log("Total Parsed Snapcards No.: " + snapcardParsed.length);
    });

})();

