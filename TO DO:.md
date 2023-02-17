TO DO:

- Figure out how to add a database to postgresql via command line
- Add the instructions to the README for future reference (Also add the password to the config part and tell the user to add the password there. also update the repository structure and the file to add new species while i'm at it)
- Change the models folder to have all the different types of tables from that one visualization tables. For this, the Schema types from hoatzin will have to be copied over to the internal types. Each file should have one js object that is the schema type with a corresponding TS thingie. Also the Schema type has to be changed so it matches the needs of PSQL
- Add code that would add tables if they are missing, and add columns to tables if they are missing based on those JS files from the models (renamed to tables) folder
- Add a migration file that has the same code to add tables and columns, but also has code that creates entries based on the existing JSON files
- Now I can work on making queries work in my code. First I need to test whether quering maybe even spits out typed objects. If not there should be functions to change that, and then update my code to fit this new model