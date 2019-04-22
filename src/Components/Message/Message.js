/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import Reply from './Reply';
import MessageStatus from './MessageStatus';
import MessageAuthor from './MessageAuthor';
import UserTileControl from '../Tile/UserTileControl';
import ChatTileControl from '../Tile/ChatTileControl';
import UnreadSeparator from './UnreadSeparator';
import WebPage from './Media/WebPage';
import {
    getDate,
    getDateHint,
    getText,
    getMedia,
    getReply,
    getForward,
    getUnread,
    getSenderUserId,
    getWebPage,
    openMedia
} from '../../Utils/Message';
import { canSendMessages } from '../../Utils/Chat';
import { openUser, openChat } from '../../Utils/Commands';
import MessageStore from '../../Stores/MessageStore';
import TdLibController from '../../Controllers/TdLibController';
import './Message.css';

const styles = theme => ({
    messageAuthorColor: {
        color: theme.palette.primary.main
    }
});

class Message extends Component {
    constructor(props) {
        super(props);

        if (process.env.NODE_ENV !== 'production') {
            const { chatId, messageId } = this.props;
            this.state = {
                message: MessageStore.get(chatId, messageId),
                selected: false
            };
        } else {
            this.state = {
                selected: false
            };
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        const { theme, chatId, messageId, sendingState, showUnreadSeparator } = this.props;
        const { selected } = this.state;

        if (nextProps.theme !== theme) {
            return true;
        }

        if (nextProps.chatId !== chatId) {
            return true;
        }

        if (nextProps.messageId !== messageId) {
            return true;
        }

        if (nextProps.sendingState !== sendingState) {
            return true;
        }

        if (nextProps.showUnreadSeparator !== showUnreadSeparator) {
            return true;
        }

        if (nextState.selected !== selected) {
            return true;
        }

        return false;
    }

    componentDidMount() {
        MessageStore.on('updateMessageEdited', this.handleUpdateMessageEdited);
        MessageStore.on('updateMessageViews', this.handleUpdateMessageViews);
        MessageStore.on('clientUpdateMessageSelected', this.onClientUpdateMessageSelected);
        MessageStore.on('clientUpdateClearSelection', this.onClientUpdateClearSelection);
        //MessageStore.on('updateMessageContent', this.handleUpdateMessageContent);
    }

    componentWillUnmount() {
        MessageStore.removeListener('updateMessageEdited', this.handleUpdateMessageEdited);
        MessageStore.removeListener('updateMessageViews', this.handleUpdateMessageViews);
        MessageStore.removeListener('clientUpdateMessageSelected', this.onClientUpdateMessageSelected);
        MessageStore.removeListener('clientUpdateClearSelection', this.onClientUpdateClearSelection);
        //MessageStore.removeListener('updateMessageContent', this.handleUpdateMessageContent);
    }

    onClientUpdateClearSelection = update => {
        if (!this.state.selected) return;

        this.setState({ selected: false });
    };

    onClientUpdateMessageSelected = update => {
        const { chatId, messageId } = this.props;

        if (chatId === update.chatId && messageId === update.messageId) {
            this.setState({ selected: update.selected });
        }
    };

    handleUpdateMessageEdited = update => {
        const { chat_id, message_id } = update;
        const { chatId, messageId } = this.props;

        if (chatId === chat_id && messageId === message_id) {
            this.forceUpdate();
        }
    };

    handleUpdateMessageViews = update => {
        const { chat_id, message_id } = update;
        const { chatId, messageId } = this.props;

        if (chatId === chat_id && messageId === message_id) {
            this.forceUpdate();
        }
    };

    handleUpdateMessageContent = update => {
        const { chat_id, message_id } = update;
        const { chatId, messageId } = this.props;

        if (chatId === chat_id && messageId === message_id) {
            this.forceUpdate();
        }
    };

    openForward = () => {
        const { chatId, messageId } = this.props;

        const message = MessageStore.get(chatId, messageId);
        if (!message) return;

        const { forward_info } = message;
        if (!forward_info) return null;

        const { sender_user_id, chat_id } = forward_info;

        switch (forward_info['@type']) {
            case 'messageForwardedFromUser': {
                this.handleSelectUser(sender_user_id);
                break;
            }
            case 'messageForwardedPost': {
                this.handleSelectChat(chat_id);
                break;
            }
        }
    };

    handleSelectUser = userId => {
        openUser(userId);
    };

    handleSelectChat = chatId => {
        openChat(chatId);
    };

    handleSelection = () => {
        const selection = window.getSelection().toString();
        if (selection) return;

        const { chatId, messageId } = this.props;

        const selected = !MessageStore.selectedItems.has(`chatId=${chatId}_messageId=${messageId}`);
        TdLibController.clientUpdate({
            '@type': 'clientUpdateMessageSelected',
            chatId: chatId,
            messageId: messageId,
            selected: selected
        });
    };

    handleDateClick = e => {
        e.preventDefault();
        e.stopPropagation();

        const { chatId, messageId } = this.props;

        const message = MessageStore.get(chatId, messageId);

        const canBeReplied = canSendMessages(chatId);
        if (canBeReplied) {
            TdLibController.clientUpdate({
                '@type': 'clientUpdateReply',
                chatId: chatId,
                messageId: messageId
            });
            return;
        }

        const canBeForwarded = message && message.can_be_forwarded;
        if (canBeForwarded) {
            TdLibController.clientUpdate({
                '@type': 'clientUpdateForwardMessages',
                info: {
                    chatId: chatId,
                    messageIds: [messageId]
                }
            });
        }
    };

    openMedia = event => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const { chatId, messageId } = this.props;

        openMedia(chatId, messageId);
    };

    render() {
        const { classes, chatId, messageId, showUnreadSeparator } = this.props;
        const { selected } = this.state;

        const message = MessageStore.get(chatId, messageId);
        if (!message) return <div>[empty message]</div>;

        const text = getText(message);
        const webPage = getWebPage(message);
        const date = getDate(message);
        const dateHint = getDateHint(message);
        const media = getMedia(message, this.openMedia);
        const reply = getReply(message);
        const forward = getForward(message);
        this.unread = getUnread(message);
        const senderUserId = getSenderUserId(message);

        const tile = senderUserId ? (
            <UserTileControl userId={senderUserId} onSelect={this.handleSelectUser} />
        ) : (
            <ChatTileControl chatId={chatId} onSelect={this.handleSelectChat} />
        );

        const messageClassName = classNames('message', { 'message-selected': selected });

        return (
            <div className={messageClassName} onClick={this.handleSelection}>
                {showUnreadSeparator && <UnreadSeparator />}
                <div className='message-wrapper'>
                    <i className='message-select-tick' />
                    {this.unread && (
                        <MessageStatus
                            chatId={message.chat_id}
                            messageId={message.id}
                            sendingState={message.sending_state}
                        />
                    )}
                    {tile}
                    <div className='message-content'>
                        <div className='message-title'>
                            {!forward && <MessageAuthor chatId={chatId} openChat userId={senderUserId} openUser />}
                            {forward && (
                                <div className={classNames('message-author', classes.messageAuthorColor)}>
                                    Forwarded from{' '}
                                    <a className={classes.messageAuthorColor} onClick={this.openForward}>
                                        {forward}
                                    </a>
                                </div>
                            )}
                            <div className='message-meta'>
                                {/*message.id*/}
                                <span>&nbsp;</span>
                                {message.views > 0 && (
                                    <>
                                        <i className='message-views-icon' />
                                        <span className='message-views'>
                                            &nbsp;
                                            {message.views}
                                            &nbsp; &nbsp;
                                        </span>
                                    </>
                                )}
                                {message.edit_date > 0 && <span>edited&nbsp;</span>}
                                <a className='message-date' onClick={this.handleDateClick}>
                                    <span title={dateHint}>{date}</span>
                                </a>
                            </div>
                        </div>
                        {reply && <Reply chatId={message.chat_id} messageId={reply} />}
                        {media}
                        <div className='message-text'>{text}</div>
                        {webPage && (
                            <WebPage chatId={message.chat_id} messageId={message.id} openMedia={this.openMedia} />
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export default withStyles(styles, { withTheme: true })(Message);