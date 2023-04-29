
# Paw and Paper

## What does Paw and Paper do?

Paw and Paper has two main usages:

Firstly, it has powerful tools to help make your roleplay more immersive. You can create extremely customizable characters including name, avatar, species, pronouns, description, and color. You can also send messages as though they are coming from these characters.

But this is far from the end: Roleplayers can also set custom skills/ability scores, that they can then use to roll dice. Users can also find, visit and talk to people from other servers to get to know more people and roleplay together!

With the same characters that you already created, you can now take part in a community-driven, interactive roleplay game about animals surviving in the wild. Your goal is to go up the ranks, level up, help out your friends and keep your stats high. You can go to different biomes, where you can find herbs, stumble upon animals to fight, or do quests.

## Why choose Paw and Paper?

Paw and Paper is a perfect companion for roleplayers, alterhumans, and anyone who enjoys RPGs.

We do our very best to make the bot as easy to use for everyone, no matter how tech-savvy they are. For this, we use all the tools that Discord gives us to make the experience as immersive as possible.

And if there is something missing that you would like to see added to the bot, you can easily suggest it, and get in touch with the developers. Monthly updates bring exciting new features to ensure the quality of P&P stays top-level.

## How do I use Paw and Paper?

Paw and Paper uses slash commands to communicate with the user. The basic command to get a list of all other commands is `/help`.

Here are some of the most important commands:

- `/name`- (Re)name and create a character

- `/pronouns`, `/avatar`, `/color` and `/description` are your main commands to customize your character

- `/species`- Give your character a species. Depending on the type of roleplay you do, this could also be a class, race, breed, etc. Choosing a species is needed to access the RPG parts of the bot.

- `/profile`- Look up all the available info about a character or change the character you are using.

- `/say` and `/proxy` are useful when you want to talk as a character.

- `/skills`, `/roll` and `/visit` (currently disabled) are great tools to enhance your own roleplay.

- `/stats`- Quick view of your characters condition in the RPG. Everything you need to know about the RPG aspects is explained along the way, after you used the /play command once. Just make sure to read all the tips given to you after creating a species, or consult the help command when you don't know what to do.

**Want to have Paw and Paper on your server? Use this link to invite it:**

https://discord.com/api/oauth2/authorize?client_id=862718885564252212&permissions=518385954112&scope=bot

**Do you have questions or need support? Join our discord server:**

https://discord.gg/9DENgj8q5Q

## Contributing

### Add a species

If you just want to suggest a species, [fill out this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).

If you want to add a species, [click here to open the appropriate file.](https://github.com/MaksiRose/paw-and-paper/blob/main/src/index.ts)

First click the edit button (in form of a pencil) at the top right of the screen. Then go to the part of the file that starts with `export const speciesInfo`, and at the bottom of it, paste this "species block" behind the last one of those species blocks:
```ts
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

```json
{
	"token": "your discord token",
	"test_guild_id": "your test guild",
	"github_token": "your github token",
	"default_color": "#b4a257",
	"error_color": "#d0342c",
	"update_channel_id": "channel users can receive updates from",
	"ticket_channel_id": "channel tickets are sent to",
	"database_password": "your database password"
}
```
> Anything that you don't have or need from this list can be left as an empty string.

To get a Discord Token, [create a Discord Application](https://discordjs.guide/preparations/setting-up-a-bot-application.html).
Generate a GitHub Token [here](https://github.com/settings/tokens).
The colors can be modified by will.

Before the config.json file can be closed, the database needs to be installed. First, [download PostgreSQL](https://www.postgresql.org/download/). Keep the server "localhost", the port "5432" and the username "postgres", the password for that username can be picked by yourself and should be added to the config.json under "database_password".

After everything is installed, open a new terminal window and type `psql` to open the SQL Shell (on Mac, a new Application should be available to do the same). In the shell, type `create database patchwork;`, then `grant all privileges on database patchwork to postgres;`. Don't forget the semicolons.

Save the config.json file, go back to the terminal, and type `npm run test`.
Alternatively, you can also [install pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) and run `npm run start`, then `npm run logs`. Other command are `npm run reload` and `npm run stop`.
If you don't use pm2, make sure to keep the terminal window open, otherwise the Bot will go offline.
If you turn off the PC that is running the Bot, the Bot will go offline. I recommend running it on a server or on a raspberry pi for this reason.

### Introduction to the repository

The repository is structured in the following way:

// THIS NEEDS UPDATING
```
src  
│   index.ts    
│
└───handlers
│   │   events.ts
│   │   commands.ts
│   │   users.ts
│   │   servers.ts
│   │   votes.ts
│   │   ...

│   
└───events
│   │   ready.ts
│   │   messageCreate.ts
│   │   interactionCreate.ts
│   │   ...
│   
└───models
│   │   profileModel.ts
│   │   serverModel.ts
│   
└───commands
│   └───miscellanious
│   │   │   help.ts
│   │   │   ticket.ts
│   │   │   ...
│   │
│   └───gameplay_primary
│   │   │   play.ts
│   │   │   explore.ts
│   │   │   ...
│   │
│   └───...
│  
└───commands_guild
│   └───(guildId...)
│   │   │   ...
│  
└───contextmenu
│   │   ...
│  
└───utils
│   │   ...
│
└───database
│   └───open_tickets
│	│	...
│
```

- `index.ts` is the main files. This is where the bot is connected to discord, and the handlers are called.
- `handlers` handles different aspects of the bot that need to be started up
    - `events.ts`: Creates a listener for every event file that is in the `events` folder. [More on event listeners](https://developer.mozilla.org/en-US/docs/Web/Events/Event_handlers). Once discords 'ready' event is fired, it will call the following handlers.
    - `commands.ts`: In `index.ts`, a commands object was created. All the files within the subfolders of the `commands` folder are added to that object.
	- `users.ts` & `servers.ts`: Updates the database users and servers.
	- `votes.ts`: Creates a listener for the event that the bot has been voted for on top.gg, discords.com or discordbotlist.com.
- `models`: This creates a schema and the functions to find or update something in the database.
- `commands` is separated based on how the commands are used. It contains files for all the commands.
- `utils` contains files with code that is used in several files to reduce code length and increase consistency.
- `database` contains `open_tickets`, which are text files of the ticket conversations had with users.
## Feedback

If you have any feedback, please [open a ticket](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement&template=feature_request.yaml&title=New+feature%3A+) or tell it to me directly on [the Bots Discord server](https://discord.gg/9DENgj8q5Q).
