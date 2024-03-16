import shelve
import telebot
import base64
import requests
import time
from datetime import datetime
from telebot import types
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from apscheduler.schedulers.background import BackgroundScheduler

import threading

db_lock = threading.Lock()

scheduler = BackgroundScheduler()

# Get token from @BotFather 
TOKEN = "YOUR_TOKEN"

bot = telebot.TeleBot(TOKEN)

def intro_menu():
    markup = InlineKeyboardMarkup()
    markup.row_width = 1
    markup.add(InlineKeyboardButton("I'm in!", callback_data='cb_join'),
                InlineKeyboardButton("Woops I wanna leave", callback_data='cb_leave'))

    return markup

def test_menu():
    markup = InlineKeyboardMarkup()
    markup.row_width = 1
    markup.add(InlineKeyboardButton("Ping me!", callback_data='cb_ping'))

    return markup

@bot.message_handler(commands=['start'])
def welcome(message):
    usernames = []
    
    with shelve.open('chat_store') as db:
        if str(message.chat.id) in db:
            usernames = list(db[str(message.chat.id)])
    usernames_str = '\n'.join(usernames)
    bot.reply_to(message, f"""Welcome! Let's create some awesome newsletters from everyone's unique experiences. Click to join! \n\nMembers ({len(usernames)}👥):\n"""+usernames_str, reply_markup=intro_menu())

@bot.message_handler(commands=['test'])
def test(message):
    bot.reply_to(message, "Give this a try!", reply_markup=test_menu())

@bot.message_handler(commands=['force'])
def test(message):
    with shelve.open('chat_store') as db:
        chat_id = str(message.chat.id)
        send_letter_link(db[chat_id], chat_id)

@bot.message_handler(commands=['gen'])
def letter_link(message):
    encoded = base64.b64encode(str(message.chat.id).encode('utf8')).decode('utf8')
    requests.get('http://ec2-3-26-187-152.ap-southeast-2.compute.amazonaws.com:3000/gen?={}'.format(encoded))
    retrieve_letter_link(message.chat.id)

@bot.message_handler(commands=['stopitcollin'])
def stop_collin(message):
    bot.reply_to(message, '@coll1nrm Collin stop it.')

# @bot.message_handler(func=lambda message: True)
# def misc_welcome(message):
#     bot.send_message(message.from_user.id, "{} said {}".format(message.from_user.first_name, message.text))


@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    if call.data == "cb_join":
        # text = call.message.text
        user = call.from_user
        text = update_user(user, call.message.chat.id)

        if text == -1:
            return bot.send_message(call.message.chat.id, "Sorry @{} you are already in!\n\nAnyways I realised singing in the shower is fun until you get soap in your mouth. Then, it's soap opera.".format(user.username))

        with shelve.open('chat_store') as db:
            print(list(db[str(call.message.chat.id)]))
            

        bot.edit_message_text(chat_id=call.message.chat.id, text=text, message_id=call.message.message_id, reply_markup=intro_menu())
    
    elif call.data == "cb_leave":
        text = call.message.text
        user = call.from_user
        text = remove_user(user, text, call.message.chat.id)

        if text == -1:
            return bot.send_message(call.message.chat.id, "Sorry @{} you are not in!\n\nAnyways I realised singing in the shower is fun until you get soap in your mouth. Then, it's soap opera.".format(user.username))


        with shelve.open('chat_store') as db:
            print(list(db))

        bot.edit_message_text(chat_id=call.message.chat.id, text=text, message_id=call.message.message_id, reply_markup=intro_menu())

    elif call.data == 'cb_ping':

        bot.send_message(call.from_user.id, "Hi there!")

def update_user(user, chat_id='unknown'):

    chat_id = str(chat_id)

    db_lock.acquire()

    with shelve.open('chat_store') as db:

        try:
            if user.username in db[chat_id]:
                db_lock.release()
                return -1
        except (TypeError, KeyError) as e:
            print(e)
            db[chat_id] = {}
        
        print(chat_id, user.username)
        tmp = {}
        tmp[user.username] = user
        db[chat_id] = tmp
        print(list(db))
        usernames = list(db[chat_id])
        text = f"""Welcome! Let's create some awsome newsletters from everyone's unique experiences. Click to join! \n\nMembers ({len(usernames)}👥):"""
        for username in db[chat_id]:
            stored = db[chat_id][username]
            text += '\n{}'.format(stored.username)
        count = len(db[chat_id])

        db_lock.release()

        return text

def remove_user(user, text, chat_id='unknown'):

    chat_id = str(chat_id)

    db_lock.acquire()

    with shelve.open('chat_store') as db:

        try:
            if user.username not in db[chat_id]:
                db_lock.release()
                return -1
        except (TypeError, KeyError) as e:
            print(e)
            db[chat_id] = {}
        
        tmp = db[chat_id]
        del tmp[user.username]

        if len(tmp) == 0:
            del db[chat_id]
        else:
            db[chat_id] = tmp

        usernames = list(tmp)
        text = f"""Welcome! Let's create some awsome newsletters from everyone's unique experiences. Click to join! \n\nMembers ({len(usernames)}👥):\n"""
        for username in tmp:
            stored = tmp[username]
            text += '\n{}'.format(stored.username)

        db_lock.release()

        return text


# Code to automate sending of newsletter

def send_letter_link(db, chat_id):
    for username in db:
        try:
            user = db[username]
            encoded = base64.b64encode(user.username.encode('utf8')).decode('utf8')
            group = base64.b64encode(chat_id.encode('utf8')).decode('utf8')
            bot.send_message(user.id, """<b>Hi {}! It's that time of the month!</b>\n\nWrite your thoughts <a href="http://ec2-3-26-187-152.ap-southeast-2.compute.amazonaws.com:3000/?n={}&g={}">here</a>!""".format(user.first_name, encoded, group), parse_mode='html')
            print("message sent to {}, id: {}".format(username, user.id))
        except Exception as e:
            print("Failed sending to {}, id: {}. {}".format(username, user.id, e))
        time.sleep(2)


def send_letter_link_loop():
    with shelve.open('chat_store') as db:
        for chat_id in db:
            send_letter_link(db[chat_id], chat_id)

def retrieve_letter_link(chat_id):
    now = datetime.now()
    issue = '{}-{}'.format(now.month, str(now.year)[-2:])

    print(chat_id)
    bot.send_message(chat_id, """<b>Good news! This month's newsletter is out!</b>\n\nCheck it out <a href="http://ec2-3-26-187-152.ap-southeast-2.compute.amazonaws.com:3000/archives/{}/issue_{}.html">here</a>!""".format(chat_id, issue), parse_mode='html')

def retrieve_letter_link_loop():
    with shelve.open('chat_store') as db:
        for chat_id in db:
            retrieve_letter_link(chat_id)

# def wake_render():
#     res = requests.get('https://in-the-loop.onrender.com/')
#     print('Wake render at {}: {}'.format(datetime.now(), res))

scheduler.add_job(send_letter_link_loop, trigger='cron', day='1')
scheduler.add_job(retrieve_letter_link_loop, trigger='cron', day='10')
# scheduler.add_job(wake_render, trigger='interval', minutes=10, jitter=10)

scheduler.start()
# https://apscheduler.readthedocs.io/en/3.x/userguide.html
# https://apscheduler.readthedocs.io/en/3.x/userguide.html#removing-jobs
# https://apscheduler.readthedocs.io/en/3.x/modules/triggers/cron.html

print('TELEBOT STARTING!')

c1 = types.BotCommand(command='start', description='Start the Bot')

bot.set_my_commands([c1])

bot.polling()