# Team C1 User Guide

## Endorsements
We added a button to endorse posts and replies.
To use and test it:
1. Create an instructor account
2. Navigate to a post.
3. You should see an "Endorse" button next to the "Reply" and "Quote" buttons
4. Click it and verify that the text changes to "Unendorse" and a green banner appears stating that an instructor (your username) endorsed the post.
5. Click the "Unendorse" button and verify that the banner disappears.
6. Create other accounts and verify that endorsements are visible for everyone.
7. Create a student account and verify that you cannot endorse posts.

### Tests
The tests for this feature can be found in test/posts.js on lines 310-344. They test three behaviors:
1. An instructor should be able to endorse a post
2. An instructor should be able to unendorse a post
3. A student should get an error when trying to endorse a post
4. A student should get an error when trying to unendorse a post

These are the four desired behaviors for the backend.