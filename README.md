
# Paw and Paper

Paw and Paper is a Discord Bot, an interactive roleplay game with a focus on animals rather than humans. After choosing a name and a species, you will be welcomed to your pack. You start as a Youngling, and your goal is to go up the ranks, gain as much experience as possible, explore all the places and help out your pack. You can go to different biomes, where you can find herbs, stumble upon animals to fight, or do quests. But beware of your stats! If one of them reaches zero, you will pass out and lose all your items.
This game has a heavy focus on player-to-player interaction, so it's best to bring some friends to play it with!

**Want to have Paw and Paper on your server? Use this link to invite it:**

https://discord.com/api/oauth2/authorize?client_id=862718885564252212&permissions=518385954112&scope=bot

**Do you have questions or need support? Join our discord server:**

https://discord.gg/9DENgj8q5Q

## Features

- Extensive profile customization, with up to three profiles per server
- Exploring (ft. custom minigames), quests, attacking, playing, ranking up
- Sleeping, eating, drinking, healing, plant watering, personal and server inventory
- Hugging others, sharing others, playfighting others (playing Tic Tac Toe or Connect Four)
- Custom roleplaying with others using your character
- Visiting other servers
- Shop to gain roles

## Contributing

### Add a species

If you just want to suggest a species, [fill out this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).

If you want to add a species, [click here to open the appropriate file.](https://github.com/MaksiRose/paw-and-paper/blob/main/src/typedef.ts)

First click the edit button (in form of a pencil) at the top right of the screen. Then go to the bottom of the file, and paste this "species block" behind the last one of those species blocks:
```
'NAME': {
	diet: 'SpeciesDietType.Herbivore/SpeciesDietType.Omnivore/SpeciesDietType.Carnivore',
	habitat: 'SpeciesHabitatType.Cold/SpeciesHabitatType.Warm/SpeciesHabitatType.Water',
	biome1OpponentArray: ['ABC', 'DEF', 'GHI'],
	biome2OpponentArray: ['JKL', 'MNO'],
	biome3OpponentArray: ['PQR', 'STU'],
},
```
Replace NAME with the name of your species. Make sure to always use lowercase.

**Note:** Species should not be extinct, mythical, and should not be too specific, for example a breed of dog, or they will not be accepted. Rule of thumb is that if it is so similar to another animal that they can be grouped together without changing anything in that block, they should be grouped together.

Keep either herbivore, omnivore or carnivore depending on the diet of that species. Choose whether the species prefers cold or warm environments, or if it lives in the water.

In the three following Arrays, reference 2-4 animals each. Make sure that you use the exact name used for an animal in one of the previous species blocks. Make sure that the animals are those that your animal would actually meet and interact with. Biome1 should contain animals that are easy to defeat, Biome2 should contain animals that are equally strong, and Biome3 should contain animals that would most likely defeat your animal.

You should also make sure to go to the species blocks of the animals you referenced, and paste in your animal into the appropriate one of their biome opponent arrays. You don't have to do this for every animal you referenced.

### Create a new issue

If you see a problem in the code or one comes up during usage, search if an issue already exists. If a related issue doesn't exist, open a new one. You can also use the ticket command from within the Bot to start a new issue.

### Solve an issue

If you find an issue that you would like to fix, first make sure that you can replicate it. If you can confirm the issue, clone the repository, then start working on a fix. Once you believe you have fixed the issue, you can create a pull request.

If you find a smaller issue like a typo, you can open the file from within GitHub, click on edit, fix it and then propose changes.

### Cloning the repository

Open a terminal and use the 'cd' command do navigate to the folder that you want the repository to be cloned to. then write:

```bash
git clone https://github.com/MaksiRose/paw-and-paper.git
git checkout stable
npm install
```

Keep the terminal open, you will need it later.
In the repository, create a config.json file.
This needs to include the following information:

```
{
	"token": "your discord token",
	"test_token": "another discord token for a test bot, if necessary",
	"bfd_token": "your discords.com token",
	"bfd_authorization": "authorization chosen on discords.com",
	"top_token": "your top.gg token",
	"top_authorization": "authorization chosen on top.gg",
	"dbl_token": "your discordbotlist.com token",
	"dbl_authorization": "authorization chosen on discordbotlist.com",
	"github_token": "your github token",
	"default_color": "#b4a257",
	"error_color": "#d0342c",
}
```
> Anything that you don't have or need from this list can be left as an empty string.

To get a Discord Token, [create a Discord Application](https://discordjs.guide/preparations/setting-up-a-bot-application.html).
Generate a GitHub Token [here](https://github.com/settings/tokens).
The colors can be modified by will.

After you saved the config.json file, go back to the terminal, and type either `npm run localstart` or `npm run localtest`.
Alternatively, you can also [install pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run `npm run start`, then `npm run logs`. Other command are `npm run reload` and `npm run stop`.
If you don't use pm2, make sure to keep the terminal window open, otherwise the Bot will go offline.
If you turn off the PC that is running the Bot, the Bot will go offline. I recommend running it on a server or on a raspberry pi for this reason.

### Introduction to the repository

The repository is structured in the following way:

```
project
│   paw.js    
│   index.js    
│   testindex.js    
│
└───handlers
│   │   events.js
│   │   commands.js
│   │   profiles.js
│   │   servers.js
│   │   votes.js
│   
└───events
│   │   ready.js
│   │   messageCreate.js
│   │   interactionCreate.js
│   │   ...
│   
└───models
│   │   constructor.js
│   │   profileModel.js
│   │   serverModel.js
│   
└───commands
│   └───bot
│   │   │   help.js
│   │   │   ticket.js
│   │   │   ...
│   │
│   └───gameplay
│   │   │   play.js
│   │   │   explore.js
│   │   │   ...
│   │
│   └───interaction
│   │   │   playfight.js
│   │   │   say.js
│   │   │   ...
│   │
│   └───maintenance
│   │   │   rest.js
│   │   │   stats.js
│   │   │   ...
│   │
│   └───profile
│   │   │   name.js
│   │   │   species.js
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
│	│
│   └───toDelete
│	│	...
│	│
│   └───bannedList.json
│   └───toDeleteList.json
│   └───voteCache.json
│   └───webhookCache.json
```

- `paw.js` and the index files are the main files. This is where the discord js are started, and the events handler is called.
- `handlers`
    - `events.js`: Creates a listener for every event file that is in the `events` folder. [More on event listeners](https://developer.mozilla.org/en-US/docs/Web/Events/Event_handlers). Once discords 'ready' event is fired, it will call the following handlers.
    - `commands.js`: In `paw.js`, a commands object was created. All the files within the subfolders of the `commands` folder are added to that object.
	- `profiles.js` & `servers.js`: Updates the database profiles and servers.
	- `votes.js`: Creates a listener for the event that the bot has been voted for on top.gg, discords.com or discordbotlist.com.
- `models`: This contains the `constructor.js`, which is called in `profileModel.js` and `serverModel.js`. This creates a schema and the functions to find or update something in the database.
- `commands` is separated based on how the commands are used. It contains files for all the commands.
- `utils` contains files with code that is used in several files to reduce code length and increase consistency.
- `database` contains `profiles` and `servers`, which then contain the documents of all servers and users, as well as `toDelete` and `toDeleteList.json`, which is responsible for storing files that will be deleted at a later point (when the bot leaves a server or a member leaves a server for example). It also has `bannedList.json` which contains users and servers that are banned from using the bot, `voteCache.json` which contains data about which users votes where and when, and `webhookCache.json` which contains data about which webhook messages were created because of which user.
## Feedback

If you have any feedback, please [open a ticket](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement&template=feature_request.yaml&title=New+feature%3A+) or tell it to me directly on [the Bots Discord server](https://discord.gg/9DENgj8q5Q).
