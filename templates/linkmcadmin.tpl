<div class="panel panel-default ns-custom-fields-panel">
    <div class="panel-body text-center">
        <form method="GET" action="linkmc/callback">
            <input class="form-control" type="text" name="username" id="inputname" placeholder="minecraft username" pattern="\w\{0,16}" value="">
            <br>
            <div id="checkResult">Please check account before submitting.</div>
            <br>
            <a id="goBack" href="../edit" class="btn btn-primary">Go Back</a>
            <button id="checkBtn" type="button" onclick="checkBtn()" class="btn btn-primary">Check Account Name</a>
            <button id="submitBtn" type="submit" href="#" class="btn btn-primary">Link Account</a>
        </form>
    </div>
</div>