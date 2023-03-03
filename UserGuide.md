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

These are the three desired behaviors for the backend.

## Post Anonymously
How to test the Post Anonymously feature:
1. Log in/Sign up as a student or professor
2. Click any category (i.e. Announcements, General Discussion, etc.)
3. Click "New Topic"
4. Fill out the contents of your post. Before submitting, check the 
    "Post Anonymously" checkbox
5. Hit submit
6. Click "NodeBB" in the upper left corner to go back to the home screen
7. Click the category that you went to in step (2)
8. At this point, you should be able to see a list of posts (or just your
    post if that is the only post that has been made so far). As you will 
    see, your post should have an anonymous profile picture, and where the
    poster's username would normally appear now instead shows as 
    "anonymous". Unlike on a post that was not posted anonymously, when you
    click on either the profile picture and/or the username, doing so on an
    anonymous post will not take you to the original poster's profile.
9. Note: if you would like to see that these features are not present when
    a post is made publicly (i.e. not anonymously), you can create another 
    post, this time submitting without checking the "Post Anonymously" 
    checkbox.

How to test the Post Anonymously feature:
1. Open Terminal (or an equivalent application)
2. CD into the root directory
3. Run: npm run test
4. After a few minutes, you should see that the newly included test cases
    referring to this feature all pass.

Information on the Post Anonymously tests:
    Location: 2 tests pertaining to this featuer are provided in 
              spring23-nodebb-team-c1/test/topics/events.js
    Justification: 
        isAnonymous_false). This test case creates a new post with the default 
                            value of isAnonymous = false. This is consistent
                           to the value of isAnonymous for all new posts. It 
                            then verifies that the value of isAnonymous for that 
                            post is indeed false, as we would expect. This test 
                            passes as expected.
        isAnonymous_true). This test case creates a new post with the default 
                           value of isAnonymous = false. In reality, isAnonymous 
                           is changed to true once the checkbox is clicked. The 
                           value of this checkbox is called via the .val()
                           method. However, there is no way to reference this 
                           checkbox within this unit test, so I had to 
                           simulate this experience. Thus, I am simulating this 
                           behavior to make sure that isAnonymous actually 
                           returns true when toggleBox is set to true.
        No other tests are needed since the boolean value of isAnonymous
        fully determines whether or not the anonymous profile picture and 
        username appear.
        
## Private Question
To use and test it:
1. Create an account
2. Navigate to General Discussions (or another category)
3. Click the "New Topic" button
4. You should see a toggle labeled as "Make Private"
5. Turn the toggle on and make a private post
6. You should see a "PRIVATE" label next to the topic title
7. Go back to the General Discussion topics list
8. Create a few more private and public posts
9. You should see private labels for private posts and no labels for public posts
10. Create another account
11. Navigate to the General Discussion topics list
12. Click on one of the private posts from the first user
13. You should see an error page indicating no privilege
14. On prexisting accounts, you should notice no increase in unread notifications from private marked posts

### Tests
The tests for this feature can be found in test/topics.js.
The test case creates a new topic with isPrivate set to true and verifies its value in the "should not receive errors" section. 

