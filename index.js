let app = require('express')();
let http = require('http').createServer(app);
let io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let connections = 0;
const user = {id: 0, username: "nousr", chatColour: "noclr"};
const users = [];
let chatMessages = [];


io.on('connection', (socket) => {
    // console.log(users);
    console.log("\nNew connection")
    const user = addNewDefaultUser(socket.id);
    io.to(socket.id).emit('query cookies');
    connections++;
    updateUsers();  //update list of users
    console.log("\nUsers before emit new connection");
    console.log(users);
    chatMessages.forEach(message => {
        io.to(socket.id).emit('chat message', message);
    });
    io.emit('chat message', timestamp() + ' '+ "New user joined! ");
    // io.emit('chat message', timestamp() + ' '+ "New user joined! " + getUser(socket.id).username);

    socket.on('chat message', (msg) => {
        if(isCommand(msg)) {
            const usernameChangeCommand = "/name";
            const chatColourChangeCommand = "/color";
            let str = msg.split(' ');
            if(str.length !== 2) {
                io.to(socket.id).emit('chat message', "Error: Incorrect command usage! (e.g. /color blue or /name Gerald");
                return false;
            }
            if(msg.startsWith(usernameChangeCommand)) {
                console.log(str[1]);
                if(!usernameTaken(str[1])) {
                    user.username = String(str[1]);
                    io.to(socket.id).emit('chat message', "Username changed to: " + user.username);
                    updateUsers();
                    io.to(socket.id).emit('update storage', getUser(socket.id));
                }
                else
                    io.to(socket.id).emit('chat message', "Error: Username taken!");
            }
            else if(msg.startsWith(chatColourChangeCommand)) {
                console.log(str[1]);
                user.chatColour = String(str[1]);
                io.to(socket.id).emit('chat message', "Chat colour changed to: " + user.chatColour);
                io.to(socket.id).emit('update storage', getUser(socket.id));
                // TODO implement check for valid color
            }
            else
                io.to(socket.id).emit('chat message', "Error: Incorrect command usage! (e.g. /color blue or /name Gerald");
        }
        // check valid message
        else if(isMessage(msg, socket)) {
            // convert shorthand into emojis
            msg = convertEmojis(msg);
            // message that is sent our to all other users
            let chatMessage = timestamp() + ' ' + String(user.username) + ': ' + '<span style="color:'+user.chatColour+';">' + msg + '</span>';
            // message that is sent out to the user that composed it
            let boldChatMessage = timestamp().bold() + ' ' + String(user.username).bold() + ': ' + '<span style="color:'+user.chatColour+';">' + msg + '</span>';
            // send bold message to chat author
            io.to(socket.id).emit('chat message', boldChatMessage)
            // send message to other chat users

            socket.broadcast.emit('chat message', chatMessage);
            chatMessages.push(chatMessage);
            // socket.broadcast.emit???
            //  Update cookies on client side
            // io.to(socket.id).emit('update storage', getUser(socket.id)); TODO include this?

        }

    });
    socket.on('cookie check', (clientCookies) => {
        console.log("clientCookies is: " + clientCookies[0] + " " + clientCookies[1]);
        updateUserParameters(socket.id, clientCookies);
        updateUsers();
        // io.to(socket.id).emit('update storage', getUser(socket.id)); // is this redundant
        io.emit('chat message', timestamp() + ' '+ "Welcome back <b>" + getUser(socket.id).username + "</b>!");
    });
    socket.on('disconnect', () => {
        // send message that user has left
        const user = getUser(socket.id);
        socket.broadcast.emit('chat message', "User " + user.username + " has left!");
        // pop users from stack
        removeUser(socket.id);
        // update list of users in sidebar
        updateUsers();  //update list of users
        connections--;
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});

function isMessage(msg, socket) {
    if (msg.length < 1) {
        return false;
    } else if (msg.includes('/') || msg.includes('<')) {
        io.to(socket.id).emit('chat message', "Error: Chat message contains restricted characters.");
        return false
    }
    return true;
}

function isCommand(msg) {
    if (msg.startsWith('/')) {
        return true;
    }
    return false;
}

function timestamp() {
    let currentDate = new Date();
    let today = currentDate.toLocaleDateString('en-GB', {
        day : 'numeric',
        month : 'short',
        year : 'numeric'
    });
    return (today + ' ' + currentDate.toLocaleTimeString());

}

function addNewDefaultUser(id) {
     // use socket.id
     // make random username
    let username = connections;
    let chatColour = "black";
    const user = {id, username, chatColour};
    users.push(user);

    return user;
}

function usernameTaken(str) {
    for( let i = 0; i < users.length; i++) {
        if(str === users[i].username)
            return true;
    }
    return false;
}

function getUser(id) {
    for (let i = 0; i < users.length; i++) {
        if(users[i].id === id)
            return users[i];
    }
    return user;
}

function removeUser(id) {
    console.log("removing user with ID: " + id);
    for (let i = 0; i < users.length; i++) {
        if(users[i].id === id)
            users.splice(i, 1);
    }
}

function updateUsers() {
    console.log("updating users");
    let usersList = "";
    for (let i = 0; i < users.length; i++) {
        usersList += users[i].username + "<br>";
    }
    for (let i = 0; i < users.length; i++) {
        let socketID = users[i].id;
        io.to(socketID).emit('online users', usersList);
        console.log("emitting "+usersList+" to: +" + socketID);
    }
    //io.to(socket.id).emit
    // io.emit('online users', usersList);
    console.log("finished updating users");
    console.log(users);
}

function updateUserParameters(id, cookies) {
    console.log("updating user parameters");
    console.log(users);
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === id) {
            console.log("i is: " + i + " users[i].id: " + users[i].id + " id: " + id);
            console.log("found user: " + id + " with name: " + cookies[0] + " and user name: " + cookies[1]);
            users[i].username = cookies[0];
            users[i].chatColour = cookies[1];
        }
    }
}

// Searches for instances of example conversions in requirements and replaces them with the appropriate UTF-8 emoji
function convertEmojis(str) {
    let msg = str;
    msg =  msg.replace(/:\)/g, "&#128513;");    //smiley face
    msg =  msg.replace(/:\(/g, "&#128577;");    //slightly frowning face
    msg =  msg.replace(/:o/g, "&#128562;");     //surprised face
    return msg;
}