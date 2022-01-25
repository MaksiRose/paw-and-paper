
# Paw and Paper

Paw and Paper is a Discord Bot, providing an interactive roleplay game about surviving in the wild with your friends. Your goal is it to rank and level up, explore all the places and help out your pack. Make sure you don't pass out!
## Features

- Profile Customization: Name, species, description, pronouns, color, and avatar
- Play, explore, heal, and share stories with others
- Find quests and complete them to rank up
- Gain XP and levels, take care of your health, energy, hunger and thirst
- Travel around the pack, and fill its inventory with herbs you found and animals you killed
- Speak as your character and roleplay with others
## Installation

After downloading the latest release, open a Terminal and navigate to the folder.
There is a few things you need to install:

```bash
npm install discord.js
npm install @octokit/rest
```

Keep the terminal open, you will need it later.
In the folder, create a config.json file.
This needs to include the following information:

```
{
    "token": "your discord token",
    "github_token": "your github token",
    "prefix": "rp ",
    "default_color": "#9d9e51",
    "error_color": "#d0342c",
}
```

To get a Discord Token, [create a Discord Application](https://discordjs.guide/preparations/setting-up-a-bot-application.html).
Generate a GitHub Token [here](https://github.com/settings/tokens).
The prefix and the colors can be modified by will.

After you saved the config.json file, go back to the terminal, and type either `node .` or `node paw.js`.
Alternatively, you can also [install pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run `pm2 start paw.js`, then `pm2 logs`.
If you don't use pm2, make sure to keep the terminal window open, otherwise the Bot will go offline.
If you turn off the PC that is running the Bot, the Bot will go offline. I recommend running it on a server or on a raspberry pi for this reason.
## Lessons Learned

I created this Bot because I was looking for an RPG that didn't center humans or human-like creatures as its player character, but non-human animals instead. I didn't find one, so I decided to create one myself. My goal was it to make something that is fun to play, creates a roleplay vibe, and keeps things fairly realistic.

Since this was my first serious programming project, I had to rework my code several times. But the more time I spent optimizing, the more confident I feel about what I created. I believe this bot can serve as a great template for anyone who doesn't just want to make a simple Utility Bot, but a serious text-based game.

Not only did this help me improve my understanding of node js and coding in general, but it also helped me understand a few things about game design, and how to engage a user.
## Contributing

#### Introduction to the repository

The repository is structured in the following way:

```
project
│   paw.js    
│
└───handlers
│   │   events.js
│   │   commands.js
│   
└───events
│   │   ready.js
│   │   messageCreate.js
│   │   interactionCreate.js
│   │   ...
│   
└───models
│   │   modelConstructor.js
│   │   profileModel.js
│   │   serverModel.js
│   
└───commands
│   └───creation
│   │   │   help.js
│   │   │   ...
│   │
│   └───general
│   │   │   ticket.js
│   │   │   ...
│   │
│   └───specific
│   │   │   restart.js
│   │   │   ...
│   │
│   
└───utils
│   ...
│
└───database
│   └───profiles
│	│	...
│	│
│   └───servers
│	│	...
```

- `paw.js` is the main file. This is where mongoDB and discord js are started, and the handlers are called.
- `handlers`
    - `event.js` basically creates a client.on() function for every file that is in the `events` file
    - `commands.js`: In `paw.js`, a [Discord Collection](https://discordjs.guide/additional-info/collections.html#array-like-methods) was created. All the files within the subfolders of the `commands` folder are added to that collection.
- `models`: This contains the `modelConstructor.js`, which is called in `profileModel.js` and `serverModel.js`. They are called in the `events`, `utils` and `commands` folders whenever a document needs to be found or updated.
- `commands` is separated into `creation`, `general` and `specific` based on how the commands are used: `creation` contains all the commands needed to create an account, `specific` contains all the commands that are limited to certain users, and `general` contains all other commands.
- `utils` contains files with code that is used in several files to reduce code length and increase consistency.
- `database` contains `profiles` and `servers`, which then contain the documents of all servers and users.


#### Create a new issue

If you see a problem in the code or one comes up during usage, search if an issue already exists. If a related issue doesn't exist, open a new one. You can also use the ticket command from within the Bot to start a new issue.


#### Solve an issue

If you find an issue that you would like to fix, first make sure that you can replicate it. If you can confirm the issue, open a new branch that references the issue number, then start working on a fix. Once you believe you have fixed the issue, you can create a pull request.

If you find a smaller issue like a typo, you can open the file from within GitHub, click on edit, fix it and then propose changes.


#### Add a species

If you want to add a species, you can find the maps on `utils/maps.js`.

Go to the bottom of the file, and then paste this "species block" behind the last one of those species blocks:
```
speciesMap.set('NAME', {
	name: 'NAME',
	diet: 'herbivore/omnivore/carnivore',
	habitat: 'cold/warm/water',
	biome1OpponentArray: ['ABC', 'DEF', 'GHI'],
	biome2OpponentArray: ['JKL', 'MNO'],
	biome3OpponentArray: ['PQR', 'STU'],
});
```
Replace NAME with the name of your species. Make sure to always use lowercase.

**Note:** Species should not be extinct, mythical, and should not be too specific, for example a breed of dog, or they will not be accepted. Rule of thumb is that if it is so similar to another animal that they can be grouped together without changing anything in that block, they should be grouped together.

Keep either herbivore, omnivore or carnivore depending on the diet of that species. Choose whether the species prefers cold or warm environments, or if it lives in the water.

In the three following Arrays, reference 2-4 animals each. Make sure that you use the exact name used for an animal in one of the previous species blocks. Make sure that the animals are those that your animal would actually meet and interact with. Biome1 should contain animals that are easy to defeat, Biome2 should contain animals that are equally strong, and Biome3 should contain animals that would most likely defeat your animal.

You should also make sure to go to the species blocks of the animals you referenced, and paste in your animal into the appropriate one of their biome opponent arrays. You don't have to do this for every animal you referenced.
## Feedback

If you have any feedback, please [open an issue on the GitHub repository](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=).
