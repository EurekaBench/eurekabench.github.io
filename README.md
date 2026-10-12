# eurekabench.github.io

The contribution form posts to FormSubmit, which forwards submissions to
`ogeng@cs.cmu.edu`. It sets the contributor’s email as the reply-to address.

Before accepting contributions, submit the form once and activate the receiving
address using the confirmation email from FormSubmit. Check that the submission
arrives in the mailbox after activation. See the
[FormSubmit setup instructions](https://formsubmit.co/) and
[AJAX documentation](https://formsubmit.co/ajax-documentation).

Browser tests can intercept the FormSubmit request to check success, failure,
and pending activation states without emailing test data. A mocked response does
not verify delivery to the receiving mailbox.
