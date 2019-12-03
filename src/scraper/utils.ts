import * as http from 'http';
import * as fs from 'fs';

const download = async (url: URL, dest: fs.PathLike): Promise<boolean> => {
    const file = fs.createWriteStream(dest);

    http.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(); // close() is async, call cb after close completes.
            return true;
        });
    }).on('error', function() {
        fs.unlink(dest, () => {});
        return false;
    });

    return false;
};
